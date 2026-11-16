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

// Start calls this once per SSR request and once in the browser, so each
// request gets its own QueryClient: a module-level one would let one
// player's cached data render into another's HTML.
export function getRouter() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				// Above zero so the SSR-dehydrated data isn't refetched on hydration.
				staleTime: 30_000,
				// Mutations write their results into the cache (no reactivity), so
				// a refetch on every tab focus would only spend the Workers request
				// quota re-reading what the client has. `/world` opts back in for
				// the character alone (session-takeover detection).
				refetchOnWindowFocus: false,
				retry: 1,
			},
		},
		// Single active session (threat #5): when another tab or device takes
		// the character over, our next write fails with "Session lost". The
		// refetched character carries the other token, and `/world` shows the
		// session-lost modal from that.
		mutationCache: new MutationCache({
			onError: (error) => {
				if (isSessionLost(error)) {
					// Several writes failing together join one refetch.
					void queryClient.invalidateQueries(
						{ queryKey: trpc.characters.byId.pathKey() },
						{ cancelRefetch: false },
					);
				}
			},
		}),
	});
	const trpcClient = makeTRPCClient();
	// Declared after the QueryClient it wraps; the mutation cache above only
	// reads it once a mutation has run.
	const trpc: TRPC = createTRPCOptionsProxy<AppRouter>({
		client: trpcClient,
		queryClient,
	});

	const router = createTanStackRouter({
		routeTree,
		context: { queryClient, trpc },
		scrollRestoration: true,
		defaultPreload: "intent",
		// Loaders always run; the query cache decides what is fresh.
		defaultPreloadStaleTime: 0,
		// Fire hover-intent preload with no dwell time. Default is ~50ms, which
		// loses the window when a user hovers briefly before clicking. With 0
		// the loader starts on the first hover event — by the click, beforeLoad
		// + loader are usually done, so the route swap is sync.
		defaultPreloadDelay: 0,
		Wrap: ({ children }) => (
			<TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
				{children}
			</TRPCProvider>
		),
	});
	// Provides the QueryClientProvider and dehydrates the SSR cache.
	setupRouterSsrQueryIntegration({ router, queryClient });
	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
