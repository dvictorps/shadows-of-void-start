import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useTRPC } from "#/integrations/trpc/client";
import { CLOCK_RESYNC_MS, syncServerClock } from "#/lib/server-clock";

export function useServerClockSync(): void {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	useEffect(() => {
		const fetchServerTime = async () => {
			const { now } = await queryClient.query({
				...trpc.clock.now.queryOptions(),
				staleTime: 0,
				gcTime: 0,
				retry: false,
			});
			return now;
		};
		const onVisible = () => {
			if (document.visibilityState !== "visible") return;
			void syncServerClock(fetchServerTime, { minIntervalMs: CLOCK_RESYNC_MS });
		};
		void syncServerClock(fetchServerTime);
		document.addEventListener("visibilitychange", onVisible);
		return () => document.removeEventListener("visibilitychange", onVisible);
	}, [trpc, queryClient]);
}
