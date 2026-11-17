import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useTRPC } from "#/integrations/trpc/client";
import type { LeaderboardQuery } from "#/lib/api-types";

const LEADERBOARD_REFETCH_MS = 5 * 60_000;

export function useLeaderboardSnapshot(isOpen: boolean) {
	const [query, setQuery] = useState<LeaderboardQuery>({
		category: "level",
		mode: "softcore",
	});
	const trpc = useTRPC();
	const { data: snapshot, isError: failed } = useQuery({
		...trpc.leaderboard.getSnapshot.queryOptions(query),
		enabled: isOpen,
		staleTime: LEADERBOARD_REFETCH_MS,
		refetchInterval: LEADERBOARD_REFETCH_MS,
	});
	return { snapshot, failed, query, setQuery };
}
