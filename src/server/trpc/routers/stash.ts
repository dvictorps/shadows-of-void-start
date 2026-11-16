import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import {
	createInventorySlotAllocator,
	createStashSlotAllocator,
	STASH_MAX_SLOTS,
} from "#/game/inventory/constants";
import { SERVER_ERRORS } from "#/lib/server-errors";

import { assertInCity } from "../../city";
import { batchAll } from "../../db/client";
import { items, stashModeOf } from "../../db/schema";
import { inInventoryOf, inStash, loadInventorySlots } from "../../item-reads";
import { fail, notFound } from "../errors";
import { characterSessionProcedure, router } from "../init";

// Mirrors convex/stash.ts. The stash belongs to the account, one per mode
// (softcore / hardcore), and is only reachable from the city. Items keep
// their id across inventory ⇄ stash.

const itemIds = z.array(z.number().int().positive());

export const stashRouter = router({
	// Ids that aren't this character's inventory items count as `failed`; when
	// the stash fills up, the rest fail too.
	depositToStash: characterSessionProcedure
		.input(z.object({ itemIds }))
		.mutation(async ({ ctx, input }) => {
			const { character } = ctx;
			assertInCity(character);
			if (input.itemIds.length === 0) return { deposited: 0, failed: 0 };

			const mode = stashModeOf(character);
			const [stashed, candidates] = await Promise.all([
				ctx.db
					.select({ stashSlot: items.stashSlot })
					.from(items)
					.where(inStash(character.authUserId, mode)),
				ctx.db
					.select({ id: items.id })
					.from(items)
					.where(
						and(inArray(items.id, input.itemIds), inInventoryOf(character.id)),
					),
			]);
			const nextSlot = createStashSlotAllocator(stashed);
			const moves = candidates
				.map(({ id }) => ({ id, slot: nextSlot() }))
				.filter((m) => m.slot !== -1);
			await batchAll(
				ctx.db,
				moves.map(({ id, slot }) =>
					ctx.db
						.update(items)
						.set({
							locationKind: "stash",
							characterId: null,
							inventorySlot: null,
							stashSlot: slot,
							stashMode: mode,
						})
						.where(inInventoryOf(character.id, id)),
				),
			);
			return {
				deposited: moves.length,
				failed: input.itemIds.length - moves.length,
			};
		}),

	withdrawFromStash: characterSessionProcedure
		.input(z.object({ itemIds }))
		.mutation(async ({ ctx, input }) => {
			const { character } = ctx;
			assertInCity(character);
			if (input.itemIds.length === 0) return { withdrawn: 0, failed: 0 };

			const mode = stashModeOf(character);
			const [inventory, candidates] = await Promise.all([
				loadInventorySlots(ctx.db, character.id),
				ctx.db
					.select({ id: items.id })
					.from(items)
					.where(
						and(
							inArray(items.id, input.itemIds),
							inStash(character.authUserId, mode),
						),
					),
			]);
			const nextSlot = createInventorySlotAllocator(inventory);
			const moves = candidates
				.map(({ id }) => ({ id, slot: nextSlot() }))
				.filter((m) => m.slot !== -1);
			await batchAll(
				ctx.db,
				moves.map(({ id, slot }) =>
					ctx.db
						.update(items)
						.set({
							locationKind: "inventory",
							characterId: character.id,
							stashSlot: null,
							stashMode: null,
							inventorySlot: slot,
						})
						.where(inStash(character.authUserId, mode, id)),
				),
			);
			return {
				withdrawn: moves.length,
				failed: input.itemIds.length - moves.length,
			};
		}),

	reorderStash: characterSessionProcedure
		.input(
			z.object({
				itemId: z.number().int().positive(),
				targetSlot: z.number().int(),
				swapWithItemId: z.number().int().positive().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { character } = ctx;
			assertInCity(character);
			if (input.targetSlot < 0 || input.targetSlot >= STASH_MAX_SLOTS) {
				fail(`Invalid stash slot: ${input.targetSlot}`);
			}
			const source = await ctx.db.query.items.findFirst({
				where: eq(items.id, input.itemId),
			});
			if (!source) notFound(SERVER_ERRORS.itemNotFound);
			if (source.authUserId !== character.authUserId) {
				fail(SERVER_ERRORS.notYourItem);
			}
			if (source.locationKind !== "stash") fail("Item is not in stash");
			const mode = stashModeOf(character);
			if (source.stashMode !== mode) fail("Item is in a different stash mode");

			const swapWith = input.swapWithItemId;
			await ctx.db.batch([
				ctx.db
					.update(items)
					.set({ stashSlot: input.targetSlot })
					.where(inStash(character.authUserId, mode, source.id)),
				...(swapWith !== undefined && swapWith !== source.id
					? [
							ctx.db
								.update(items)
								.set({ stashSlot: source.stashSlot ?? -1 })
								.where(
									and(
										inStash(character.authUserId, mode, swapWith),
										eq(items.stashSlot, input.targetSlot),
									),
								),
						]
					: []),
			]);
		}),
});
