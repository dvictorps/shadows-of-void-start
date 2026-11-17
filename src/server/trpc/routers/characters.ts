import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { planNewCharacter } from "#/game/classes/new-character";

import { characters, items } from "../../db/schema";
import { assertOwnsCharacter } from "../character-session";
import { fail } from "../errors";
import { authedProcedure, CHARACTER_COLUMNS, router } from "../init";

const characterIdInput = z.object({ id: z.number().int().positive() });

export const charactersRouter = router({
	list: authedProcedure.query(async ({ ctx }) =>
		ctx.db.query.characters.findMany({
			columns: CHARACTER_COLUMNS,
			where: and(
				eq(characters.authUserId, ctx.session.user.id),
				eq(characters.dead, false),
			),
			orderBy: desc(characters.id),
		}),
	),

	byId: authedProcedure
		.input(characterIdInput)
		.query(async ({ ctx, input }) => {
			const character = await ctx.db.query.characters.findFirst({
				columns: CHARACTER_COLUMNS,
				where: and(
					eq(characters.id, input.id),
					eq(characters.authUserId, ctx.session.user.id),
				),
			});
			return character ?? null;
		}),

	create: authedProcedure
		.input(
			z.object({
				name: z.string(),
				classId: z.string(),
				hardcore: z.boolean().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const authUserId = ctx.session.user.id;
			const existing = await ctx.db
				.select({ name: characters.name })
				.from(characters)
				.where(eq(characters.authUserId, authUserId));
			const result = planNewCharacter(
				{ ...input, hardcore: input.hardcore ?? false },
				existing.map((c) => c.name),
			);
			if (!result.ok) fail(result.error);
			const { plan } = result;
			const now = Date.now();

			const newCharacterId = sql`(select ${characters.id} from ${characters} where ${characters.authUserId} = ${authUserId} and ${characters.name} = ${plan.name})`;
			const [inserted] = await ctx.db.batch([
				ctx.db
					.insert(characters)
					.values({
						authUserId,
						name: plan.name,
						classId: plan.classId,
						hardcore: plan.hardcore,
						createdAt: now,
						hpCurrent: plan.hpCurrent,
						barrierCurrent: plan.barrierCurrent,
						potions: plan.potions,
						selectedElement: plan.selectedElement,
						...plan.stats,
					})
					.returning({ id: characters.id }),
				...plan.starterItems.map(({ slot, item }) =>
					ctx.db.insert(items).values({
						authUserId,
						locationKind: "equipped",
						characterId: newCharacterId,
						equippedSlot: slot,
						data: item,
						droppedAt: now,
						droppedFrom: "starter",
					}),
				),
			]);
			return inserted[0].id;
		}),

	remove: authedProcedure
		.input(characterIdInput)
		.mutation(async ({ ctx, input }) => {
			const character = await ctx.db.query.characters.findFirst({
				columns: { authUserId: true },
				where: eq(characters.id, input.id),
			});
			assertOwnsCharacter(character, ctx.session.user.id);
			await ctx.db.delete(characters).where(eq(characters.id, input.id));
		}),

	claimCharacterSession: authedProcedure
		.input(
			z.object({
				characterId: z.number().int().positive(),
				sessionToken: z.string().min(1),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const character = assertOwnsCharacter(
				await ctx.db.query.characters.findFirst({
					columns: { authUserId: true, activeSessionToken: true },
					where: eq(characters.id, input.characterId),
				}),
				ctx.session.user.id,
			);
			if (character.activeSessionToken !== input.sessionToken) {
				await ctx.db
					.update(characters)
					.set({
						activeSessionToken: input.sessionToken,
						activeSessionAt: Date.now(),
					})
					.where(eq(characters.id, input.characterId));
			}
			return { sessionToken: input.sessionToken };
		}),
});
