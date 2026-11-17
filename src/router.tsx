import { MutationCache, QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

import {
	makeTRPCClient,
	type TRPC,
	TRPCProvider,
} from "./integrations/trpc/client";
import { isSessionLost } from "./lib/server-error-message";
import { routeTree } from "./routeTree.gen";
import type { AppRouter } from "./server/trpc/router";

export function getRouter() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 30_000,
				refetchOnWindowFocus: false,
				retry: 1,
			},
		},
		mutationCache: new MutationCache({
			onError: (error) => {
				if (isSessionLost(error)) {
					void queryClient.invalidateQueries(
						{ queryKey: trpc.characters.byId.pathKey() },
						{ cancelRefetch: false },
					);
				}
			},
		}),
	});
	const trpcClient = makeTRPCClient();
	const trpc: TRPC = createTRPCOptionsProxy<AppRouter>({
		client: trpcClient,
		queryClient,
	});

	const router = createTanStackRouter({
		routeTree,
		context: { queryClient, trpc },
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		defaultPreloadDelay: 0,
		Wrap: ({ children }) => (
			<TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
				{children}
			</TRPCProvider>
		),
	});
	setupRouterSsrQueryIntegration({ router, queryClient });
	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
