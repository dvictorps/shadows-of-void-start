import {
	noop,
	type QueryClient,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";

import { type TRPC, useTRPC } from "#/integrations/trpc/client";

// The admin dashboard has no subscriptions (ADR 0009): its tabs poll while
// they're on screen. 30 s keeps the counters fresh enough for a control
// panel without spending the Workers request quota.
export const ADMIN_REFETCH_MS = 30_000;

/** Query options of the three tabs, with the polling interval. */
export function adminTabQueries(trpc: TRPC) {
	return {
		pulse: {
			...trpc.admin.pulse.queryOptions(),
			refetchInterval: ADMIN_REFETCH_MS,
		},
		listUsers: {
			...trpc.admin.listUsers.queryOptions(),
			refetchInterval: ADMIN_REFETCH_MS,
		},
		listAdmins: {
			...trpc.admin.listAdmins.queryOptions(),
			refetchInterval: ADMIN_REFETCH_MS,
		},
	};
}

// Fire-and-forget: by the time the user reaches a sidebar tab the queries
// have answered. Both `/character-select` and `/admin` call this from their
// loaders, and the second call dedupes in the query cache.
export function prefetchAdminTabs(queryClient: QueryClient, trpc: TRPC): void {
	const tabs = adminTabQueries(trpc);
	// A failed prefetch is retried by the tab's own query when it mounts.
	void queryClient.query(tabs.pulse).catch(noop);
	void queryClient.query(tabs.listUsers).catch(noop);
	void queryClient.query(tabs.listAdmins).catch(noop);
}

/** Role change from the Users / Admins tabs; every admin tab shows roles. */
export function useSetUserRole() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	return useMutation(
		trpc.users.setUserRole.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries({ queryKey: trpc.admin.pathKey() }),
		}),
	).mutateAsync;
}
