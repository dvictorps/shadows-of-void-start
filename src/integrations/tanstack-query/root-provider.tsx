import type { ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { convexQueryClient } from "../convex/client"
import type { ConvexQueryClient } from "@convex-dev/react-query"

let context:
	| {
			queryClient: QueryClient
			convexQueryClient: ConvexQueryClient
		}
	| undefined

export function getContext() {
	if (context) {
		return context
	}

	const queryClient = new QueryClient()
	convexQueryClient.connect(queryClient)

	context = {
		queryClient,
		convexQueryClient,
	}

	return context
}

export default function TanStackQueryProvider({
	children,
}: {
	children: ReactNode
}) {
	const { queryClient } = getContext()

	return (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	)
}
