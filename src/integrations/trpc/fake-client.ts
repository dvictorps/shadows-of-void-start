import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { z } from "zod";

import type { TRPC } from "#/integrations/trpc/client";
import type { AppRouter } from "#/server/trpc/router";

export type Json =
	| string
	| number
	| boolean
	| null
	| Json[]
	| { [key: string]: Json };

const json: z.ZodType<Json> = z.lazy(() =>
	z.union([
		z.string(),
		z.number(),
		z.boolean(),
		z.null(),
		z.array(json),
		z.record(z.string(), json),
	]),
);

export type FakeCall = { path: string; input: Json | undefined };
export type FakeReply = object | null;
export type FakeHandler = (input: Json | undefined) => FakeReply;

type WireError = {
	message: string;
	code: number;
	data: { code: string; httpStatus: number };
};
type WireBody = { result: { data: FakeReply } } | { error: WireError };

const BASE_URL = "http://trpc.test";

function reply(body: WireBody, status: number): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function failure(message: string, code: string, httpStatus: number) {
	return reply(
		{ error: { message, code: -32_600, data: { code, httpStatus } } },
		httpStatus,
	);
}

function readInput(url: URL, init: RequestInit | undefined): Json | undefined {
	const raw =
		init?.method === "POST"
			? z.string().parse(init.body)
			: url.searchParams.get("input");
	if (raw === null) return undefined;
	return json.parse(JSON.parse(raw));
}

export function fakeTrpc(handlers: Record<string, FakeHandler>) {
	const calls: FakeCall[] = [];
	const fetch = async (
		request: RequestInfo | URL,
		init?: RequestInit,
	): Promise<Response> => {
		const url = new URL(request instanceof Request ? request.url : request);
		const path = url.pathname.slice(1);
		const input = readInput(url, init);
		calls.push({ path, input });
		const handler = handlers[path];
		if (!handler) return failure(`no fake for ${path}`, "NOT_FOUND", 404);
		try {
			return reply({ result: { data: handler(input) } }, 200);
		} catch (error) {
			const message = error instanceof Error ? error.message : "fake failed";
			return failure(message, "BAD_REQUEST", 400);
		}
	};
	const trpcClient = createTRPCClient<AppRouter>({
		links: [httpLink({ url: BASE_URL, fetch })],
	});
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { staleTime: 30_000, retry: false, refetchOnWindowFocus: false },
			mutations: { retry: false },
		},
	});
	const trpc: TRPC = createTRPCOptionsProxy<AppRouter>({
		client: trpcClient,
		queryClient,
	});
	const callsTo = (path: string) =>
		calls.filter((call) => call.path === path).map((call) => call.input);
	return { trpcClient, queryClient, trpc, calls, callsTo };
}
