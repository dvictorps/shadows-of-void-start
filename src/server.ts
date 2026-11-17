import handler from "@tanstack/react-start/server-entry";

import { paraglideMiddleware } from "./paraglide/server";
import { db } from "./server/db/client";
import { computeLeaderboardSnapshot } from "./server/leaderboard";

const isApiRequest = (request: Request) =>
	new URL(request.url).pathname.startsWith("/api/");

export default {
	fetch: (request) =>
		isApiRequest(request)
			? handler.fetch(request)
			: paraglideMiddleware(request, ({ request: localized }) =>
					handler.fetch(localized),
				),

	async scheduled(controller: ScheduledController) {
		await computeLeaderboardSnapshot(db, controller.scheduledTime);
	},
} satisfies ExportedHandler<Env>;
