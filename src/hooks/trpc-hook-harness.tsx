import type { QueryKey } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { inferRouterOutputs } from "@trpc/server";
import type { ReactNode } from "react";
import { z } from "zod";

import { CHARACTER_ID } from "#/components/world/item-test-fixtures";
import { TRPCProvider } from "#/integrations/trpc/client";
import {
	type FakeHandler,
	type FakeReply,
	fakeTrpc,
	type Json,
} from "#/integrations/trpc/fake-client";
import type { BagEntry, CharacterRow, ItemRow } from "#/lib/api-types";
import { worldCache } from "#/lib/world-cache";
import type { AppRouter } from "#/server/trpc/router";

import { SessionTokenProvider } from "./useSessionToken";

type Outputs = inferRouterOutputs<AppRouter>;

export type ProcedurePath = {
	[R in keyof Outputs]: `${R & string}.${keyof Outputs[R] & string}`;
}[keyof Outputs];

export type OutputOf<P extends ProcedurePath> =
	P extends `${infer R}.${infer K}`
		? R extends keyof Outputs
			? K extends keyof Outputs[R]
				? Outputs[R][K]
				: never
			: never
		: never;

type Reply<P extends ProcedurePath> = [OutputOf<P>] extends [never]
	? []
	: [data: OutputOf<P> & object];

const callInputSchema = z.looseObject({
	characterId: z.number(),
	sessionToken: z.string(),
});

export type CallInput = z.infer<typeof callInputSchema>;

function deferred<Value>() {
	let resolve!: (value: Value) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<Value>((done, fail) => {
		resolve = done;
		reject = fail;
	});
	return { promise, resolve, reject };
}

function createFakeServer() {
	const handlers: Record<string, FakeHandler> = {};
	const fake = fakeTrpc(handlers);

	return {
		fake,
		reply<P extends ProcedurePath>(path: P, ...reply: Reply<P>): void {
			handlers[path] = () => reply[0] ?? null;
		},
		hold<P extends ProcedurePath>(path: P) {
			const arrived = deferred<CallInput>();
			const answer = deferred<FakeReply>();
			handlers[path] = (input: Json | undefined) => {
				arrived.resolve(callInputSchema.parse(input));
				return answer.promise;
			};
			return {
				arrived: arrived.promise,
				resolve: (...reply: Reply<P>) => answer.resolve(reply[0] ?? null),
				reject: (message: string) => answer.reject(new Error(message)),
			};
		},
	};
}

export interface WorldSeed {
	character?: CharacterRow;
	inventory?: ItemRow[];
	equipped?: ItemRow[];
	zoneBag?: BagEntry[];
	softcoreStash?: ItemRow[];
}

export function renderWithServer<Result>(useHook: () => Result) {
	const server = createFakeServer();
	const { trpcClient, queryClient, trpc } = server.fake;
	const cache = worldCache(trpc, queryClient, CHARACTER_ID);

	function Wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>
				<TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
					<SessionTokenProvider>{children}</SessionTokenProvider>
				</TRPCProvider>
			</QueryClientProvider>
		);
	}

	const hook = renderHook(useHook, { wrapper: Wrapper });

	function seed(world: WorldSeed): void {
		const { keys } = cache;
		const entries: [QueryKey, unknown][] = [
			[keys.character, world.character],
			[keys.inventory, world.inventory],
			[keys.equipped, world.equipped],
			[keys.zoneBag, world.zoneBag],
			[keys.stash("softcore"), world.softcoreStash],
		];
		for (const [queryKey, data] of entries) {
			if (data !== undefined) queryClient.setQueryData(queryKey, data);
		}
	}

	async function call<Value>(run: () => Promise<Value>): Promise<Value> {
		let out!: Value;
		await act(async () => {
			out = await run();
		});
		return out;
	}

	async function callRejected<Value>(
		run: () => Promise<Value>,
	): Promise<Error> {
		let caught: Error | undefined;
		await act(async () => {
			try {
				await run();
			} catch (error) {
				if (error instanceof Error) caught = error;
			}
		});
		if (!caught) throw new Error("expected the call to reject");
		return caught;
	}

	async function start<P extends ProcedurePath, Value>(
		path: P,
		run: () => Promise<Value>,
	) {
		const held = server.hold(path);
		let pending!: Promise<Value>;
		let input!: CallInput;
		await act(async () => {
			pending = run();
			input = await held.arrived;
		});
		return {
			input,
			resolve: (...reply: Reply<P>) =>
				act(async () => {
					held.resolve(...reply);
					await pending;
				}),
			reject: (message: string) =>
				callRejected(() => {
					held.reject(message);
					return pending;
				}),
		};
	}

	const isInvalidated = (queryKey: QueryKey) =>
		queryClient.getQueryState(queryKey)?.isInvalidated ?? false;

	return {
		...hook,
		server,
		cache,
		seed,
		call,
		start,
		isInvalidated,
	};
}
