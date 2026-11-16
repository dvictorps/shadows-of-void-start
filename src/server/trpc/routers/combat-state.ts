import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { characters } from "../../db/schema";
import { authedProcedure, router } from "../init";

// Mirrors convex/combatState.ts. The combat state is columns of `characters`
// now (ADR 0009 update). Unlike the Convex query, this one checks ownership:
// Convex returned any character's combat state to any signed-in user.
export const combatStateRouter = router({
	byCharacterId: authedProcedure
		.input(z.object({ characterId: z.number().int().positive() }))
		.query(async ({ ctx, input }) => {
			const row = await ctx.db.query.characters.findFirst({
				columns: {
					hpCurrent: true,
					barrierCurrent: true,
					potions: true,
					xp: true,
					etherealIncense: true,
					currentZoneKills: true,
					currentZoneSession: true,
					zoneStartedAt: true,
					campThresholdsMs: true,
					inCamp: true,
					lastCampIndex: true,
				},
				where: and(
					eq(characters.id, input.characterId),
					eq(characters.authUserId, ctx.session.user.id),
				),
			});
			return row ?? null;
		}),
});
