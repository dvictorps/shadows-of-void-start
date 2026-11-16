import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { characters } from "../../db/schema";
import { authedProcedure, router } from "../init";

// Mirrors convex/characterProgression.ts. The progression arrays are columns
// of `characters` now (ADR 0009 update); the procedure keeps its old name and
// shape so the world map / boss screens port one-to-one in phase 3.
export const characterProgressionRouter = router({
	byCharacterId: authedProcedure
		.input(z.object({ characterId: z.number().int().positive() }))
		.query(async ({ ctx, input }) => {
			const row = await ctx.db.query.characters.findFirst({
				columns: {
					unlockedNodes: true,
					completedZones: true,
					bossKillCounts: true,
				},
				where: and(
					eq(characters.id, input.characterId),
					eq(characters.authUserId, ctx.session.user.id),
				),
			});
			return row ?? null;
		}),
});
