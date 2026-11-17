import handler from "@tanstack/react-start/server-entry";

import { db } from "./server/db/client";
import { computeLeaderboardSnapshot } from "./server/leaderboard";

export default {
	fetch: (request) => handler.fetch(request),

	async scheduled(controller: ScheduledController) {
		await computeLeaderboardSnapshot(db, controller.scheduledTime);
	},
} satisfies ExportedHandler<Env>;
