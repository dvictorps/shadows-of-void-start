import {
	noop,
	type QueryClient,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";

import { type TRPC, useTRPC } from "#/integrations/trpc/client";

export const ADMIN_REFETCH_MS = 30_000;

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

export function prefetchAdminTabs(queryClient: QueryClient, trpc: TRPC): void {
	const tabs = adminTabQueries(trpc);
	void queryClient.query(tabs.pulse).catch(noop);
	void queryClient.query(tabs.listUsers).catch(noop);
	void queryClient.query(tabs.listAdmins).catch(noop);
}

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
