import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import {
	createTRPCClient,
	httpBatchLink,
	localLink,
	type TRPCLink,
} from "@trpc/client";
import {
	createTRPCContext,
	type TRPCOptionsProxy,
} from "@trpc/tanstack-react-query";

import { createContext } from "#/server/trpc/context";
import { type AppRouter, appRouter } from "#/server/trpc/router";

// The client side of ADR 0009: tRPC over the react-query cache.
//
// During SSR the procedures run in-process through `localLink`, with the
// incoming request's cookies, so a loader's prefetch is not an HTTP hop back
// into the same Worker. In the browser every call goes to `/api/trpc`. The
// server branch (and the router imports it needs) is compiled out of the
// client bundle by Start's `createIsomorphicFn`.
//
// `httpBatchLink`, not the streaming variant: the session cookie cache is
// refreshed with a `Set-Cookie` collected while the procedures run
// (src/server/trpc/context.ts), and a streamed response has already sent its
// headers by then. Batching also matters for the Workers Free request quota:
// queries fired in the same tick share one request.

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();
export type TRPC = TRPCOptionsProxy<AppRouter>;

const getLinks = createIsomorphicFn()
	.server((): TRPCLink<AppRouter>[] => [
		localLink({
			router: appRouter,
			createContext: async () => createContext(getRequest()),
		}),
	])
	.client((): TRPCLink<AppRouter>[] => [httpBatchLink({ url: "/api/trpc" })]);

export function makeTRPCClient() {
	return createTRPCClient<AppRouter>({ links: getLinks() });
}
