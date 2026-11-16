import handler from "@tanstack/react-start/server-entry";

// Worker entry (wrangler.jsonc → `main`). TanStack Start serves every HTTP
// request; the extra `scheduled` export receives the Cron Trigger that
// replaces convex/crons.ts.
export default {
	// Start reads bindings through `cloudflare:workers`, so it only needs the
	// request (its second parameter is Start's own options, not `env`).
	fetch: (request) => handler.fetch(request),

	// Hourly (`0 * * * *`). Phase 2 ports `leaderboard.computeSnapshot` here
	// (ADR 0006: cron-written snapshot table). Until then the trigger is
	// configured but has nothing to do.
	async scheduled(_controller: ScheduledController) {},
} satisfies ExportedHandler<Env>;
