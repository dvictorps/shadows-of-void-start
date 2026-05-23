import { convexQuery } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { api } from "../../convex/_generated/api";

// Fire-and-forget — by the time the user reaches a sidebar tab the
// websocket has answered. Both `/character-select` and `/admin` call this
// from their loaders so the second one dedupes via TanStack Query.
export function prefetchAdminTabs(queryClient: QueryClient): void {
	queryClient.prefetchQuery(convexQuery(api.admin.pulse, {}));
	queryClient.prefetchQuery(convexQuery(api.admin.listUsers, {}));
	queryClient.prefetchQuery(convexQuery(api.admin.listAdmins, {}));
}
