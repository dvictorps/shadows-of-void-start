import type { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { convexQueryClient } from "../convex/client";

let context:
	| {
			queryClient: QueryClient;
			convexQueryClient: ConvexQueryClient;
	  }
	| undefined;

export function getContext() {
	if (context) {
		return context;
	}

	// Defaults wire `convexQuery(api.foo, args)` keys into the live Convex
	// subscription pipeline — without these, route loaders can't prefetch
	// via `queryClient.ensureQueryData(convexQuery(...))`. The hashFn keeps
	// FunctionReference values stable across navigations.
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				queryKeyHashFn: convexQueryClient.hashFn(),
				queryFn: convexQueryClient.queryFn(),
			},
		},
	});
	convexQueryClient.connect(queryClient);

	context = {
		queryClient,
		convexQueryClient,
	};

	return context;
}

export default function TanStackQueryProvider({
	children,
}: {
	children: ReactNode;
}) {
	const { queryClient } = getContext();

	return (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}
