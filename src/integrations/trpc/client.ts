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

import { withBuildCheck } from "#/lib/app-version";
import { createContext } from "#/server/trpc/context";
import { type AppRouter, appRouter } from "#/server/trpc/router";

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();
export type TRPC = TRPCOptionsProxy<AppRouter>;

const getLinks = createIsomorphicFn()
	.server((): TRPCLink<AppRouter>[] => [
		localLink({
			router: appRouter,
			createContext: async () => createContext(getRequest()),
		}),
	])
	.client((): TRPCLink<AppRouter>[] => [
		httpBatchLink({
			url: "/api/trpc",
			fetch: withBuildCheck((input, init) => fetch(input, init)),
		}),
	]);

export function makeTRPCClient() {
	return createTRPCClient<AppRouter>({ links: getLinks() });
}
