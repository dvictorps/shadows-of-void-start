import handler from "@tanstack/react-start/server-entry";

import { db } from "./server/db/client";
import { computeLeaderboardSnapshot } from "./server/leaderboard";

// Worker entry (wrangler.jsonc → `main`). TanStack Start serves every HTTP
// request; the extra `scheduled` export receives the Cron Trigger that
// runs the leaderboard snapshot.
export default {
	// Start reads bindings through `cloudflare:workers`, so it only needs the
	// request (its second parameter is Start's own options, not `env`).
	fetch: (request) => handler.fetch(request),

	// Hourly (`0 * * * *`): the leaderboard snapshot (ADR 0006).
	async scheduled(controller: ScheduledController) {
		await computeLeaderboardSnapshot(db, controller.scheduledTime);
	},
} satisfies ExportedHandler<Env>;
