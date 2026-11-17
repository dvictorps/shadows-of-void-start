import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";

import type { TRPC } from "#/integrations/trpc/client";

export async function requireSession(context: {
	queryClient: QueryClient;
	trpc: TRPC;
}) {
	const me = await context.queryClient.query({
		...context.trpc.users.getUserRole.queryOptions(),
		staleTime: "static",
	});
	if (!me) throw redirect({ to: "/sign-in" });
	return me;
}
