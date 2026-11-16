import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";

import type { TRPC } from "#/integrations/trpc/client";

// Route guard for `beforeLoad`. Reads the caller from the query cache
// (`users.getUserRole`, null when signed out), so a navigation or a hover
// preload costs no request once the first one has answered. Sign-in and
// sign-out both reload the page, which starts a fresh cache.
//
// A UX guard only: every procedure checks the session itself.
export async function requireSession(context: {
	queryClient: QueryClient;
	trpc: TRPC;
}) {
	const me = await context.queryClient.ensureQueryData(
		context.trpc.users.getUserRole.queryOptions(),
	);
	if (!me) throw redirect({ to: "/sign-in" });
	return me;
}
