import type { QueryKey } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createTRPCClient, httpLink } from "@trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { ReactNode } from "react";
import { z } from "zod";

import { CHARACTER_ID } from "#/components/world/item-test-fixtures";
import { TRPCProvider } from "#/integrations/trpc/client";
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
	: [data: OutputOf<P>];

const callInputSchema = z.looseObject({
	characterId: z.number(),
	sessionToken: z.string(),
});

export type CallInput = z.infer<typeof callInputSchema>;

type Answer = { ok: true; data: unknown } | { ok: false; message: string };

interface Hold {
	arrive: (input: CallInput) => void;
	answer: Promise<Answer>;
}

interface Held<P extends ProcedurePath> {
	arrived: Promise<CallInput>;
	resolve: (...reply: Reply<P>) => void;
	reject: (message: string) => void;
}

const BASE_URL = "http://hooks.test/api/trpc";

function jsonResponse(answer: Answer, path: string): Response {
	if (answer.ok) {
		return Response.json({ result: { data: answer.data } });
	}
	return Response.json(
		{
			error: {
				message: answer.message,
				code: -32_600,
				data: { code: "BAD_REQUEST", httpStatus: 400, path },
			},
		},
		{ status: 400 },
	);
}

function deferred<Value>() {
	let resolve!: (value: Value) => void;
	const promise = new Promise<Value>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

function createFakeServer() {
	const replies = new Map<string, Answer>();
	const holds = new Map<string, Hold[]>();

	async function answerFor(path: string, input: CallInput): Promise<Answer> {
		const hold = holds.get(path)?.shift();
		if (hold) {
			hold.arrive(input);
			return hold.answer;
		}
		return (
			replies.get(path) ?? {
				ok: false,
				message: `fake server: no reply for ${path}`,
			}
		);
	}

	async function fetch(
		url: string | URL | Request,
		init?: RequestInit,
	): Promise<Response> {
		const href = url instanceof Request ? url.url : String(url);
		const path = new URL(href).pathname.split("/").at(-1) ?? "";
		const body = z.string().parse(init?.body);
		const input = callInputSchema.parse(JSON.parse(body));
		return jsonResponse(await answerFor(path, input), path);
	}

	return {
		fetch,
		reply<P extends ProcedurePath>(path: P, ...reply: Reply<P>): void {
			replies.set(path, { ok: true, data: reply[0] });
		},
		hold<P extends ProcedurePath>(path: P): Held<P> {
			const arrived = deferred<CallInput>();
			const answer = deferred<Answer>();
			holds.set(path, [
				...(holds.get(path) ?? []),
				{ arrive: arrived.resolve, answer: answer.promise },
			]);
			return {
				arrived: arrived.promise,
				resolve: (...reply) => answer.resolve({ ok: true, data: reply[0] }),
				reject: (message) => answer.resolve({ ok: false, message }),
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
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});
	const trpcClient = createTRPCClient<AppRouter>({
		links: [httpLink({ url: BASE_URL, fetch: server.fetch })],
	});
	const trpc = createTRPCOptionsProxy<AppRouter>({
		client: trpcClient,
		queryClient,
	});
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
