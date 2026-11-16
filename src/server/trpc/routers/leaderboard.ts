import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
	LEADERBOARD_CATEGORIES,
	leaderboardSnapshot,
	STASH_MODES,
} from "../../db/schema";
import { publicProcedure, router } from "../init";

// Mirrors convex/leaderboard.ts:getSnapshot. The snapshot is written by the
// hourly cron (src/server/leaderboard.ts); clients refetch on an interval
// instead of subscribing (ADR 0009). Public, like the Convex query.
export const leaderboardRouter = router({
	getSnapshot: publicProcedure
		.input(
			z.object({
				category: z.enum(LEADERBOARD_CATEGORIES),
				mode: z.enum(STASH_MODES),
			}),
		)
		.query(async ({ ctx, input }) => {
			const row = await ctx.db.query.leaderboardSnapshot.findFirst({
				where: and(
					eq(leaderboardSnapshot.category, input.category),
					eq(leaderboardSnapshot.mode, input.mode),
				),
			});
			return row ?? null;
		}),
});
