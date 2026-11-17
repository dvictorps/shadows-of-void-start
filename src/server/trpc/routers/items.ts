import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import {
	createInventorySlotAllocator,
	INVENTORY_MAX_SLOTS,
} from "#/game/inventory/constants";
import { resolveEquip, resolveUnequip } from "#/game/items/equip-resolution";
import { canSwapHands } from "#/game/items/equipment";
import {
	DISCARD_CAMP_ONLY,
	PICK_CAMP_ONLY,
	resolveBagExit,
	resolveBagPick,
} from "#/game/loot/bag";
import { computeStatCache } from "#/game/stats/cache";
import { EQUIPPED_SLOTS } from "#/game/stats/types";
import { SERVER_ERRORS } from "#/lib/server-errors";

import { characters, items, STASH_MODES } from "../../db/schema";
import {
	equippedOf,
	inInventoryOf,
	inStash,
	loadEquipped,
	loadInventoryItem,
	loadInventorySlots,
} from "../../item-reads";
import {
	CLEARED_ZONE,
	commitBagPicks,
	inZoneSession,
	loadBagIds,
	removeFromBag,
} from "../../zone-bag";
import { fail } from "../errors";
import { authedProcedure, characterSessionProcedure, router } from "../init";

const itemId = z.number().int().positive();
const bagIds = z.array(z.string().min(1));
const equippedSlot = z.enum(EQUIPPED_SLOTS);
const characterIdInput = z.object({ characterId: z.number().int().positive() });

export const itemsRouter = router({
	exitZone: characterSessionProcedure
		.input(z.object({ keepIds: bagIds }))
		.mutation(async ({ ctx, input }) => {
			const { id: characterId, currentZoneSession: zoneSession } =
				ctx.character;
			if (!zoneSession) return { kept: 0, discarded: 0, items: [] };

			const [bag, inventory] = await Promise.all([
				loadBagIds(ctx.db, characterId),
				loadInventorySlots(ctx.db, characterId),
			]);
			const decision = resolveBagExit({
				bagIds: bag,
				keepIds: input.keepIds,
				inCamp: ctx.character.inCamp,
				inventoryUsed: inventory.length,
			});
			if (!decision.ok) fail(decision.error);

			const nextSlot = createInventorySlotAllocator(inventory);
			const picks = decision.keep.map((bagId) => ({
				bagId,
				inventorySlot: nextSlot(),
			}));
			const kept = await commitBagPicks(
				ctx.db,
				characterId,
				zoneSession,
				picks,
				CLEARED_ZONE,
			);
			return {
				kept: kept.length,
				discarded: bag.length - kept.length,
				items: kept,
			};
		}),

	pickFromBag: characterSessionProcedure
		.input(z.object({ itemIds: bagIds }))
		.mutation(async ({ ctx, input }) => {
			if (!ctx.character.inCamp) fail(PICK_CAMP_ONLY);
			const { id: characterId, currentZoneSession: zoneSession } =
				ctx.character;
			if (!zoneSession || input.itemIds.length === 0) {
				return { kept: 0, items: [] };
			}

			const [bag, inventory] = await Promise.all([
				loadBagIds(ctx.db, characterId),
				loadInventorySlots(ctx.db, characterId),
			]);
			const picked = resolveBagPick({
				bagIds: bag,
				pickIds: input.itemIds,
				inventoryUsed: inventory.length,
			});
			if (picked.length === 0) return { kept: 0, items: [] };

			const nextSlot = createInventorySlotAllocator(inventory);
			const picks = picked.map((bagId) => ({
				bagId,
				inventorySlot: nextSlot(),
			}));
			const kept = await commitBagPicks(
				ctx.db,
				characterId,
				zoneSession,
				picks,
				{
					zoneBag: removeFromBag(picked),
				},
			);
			return { kept: kept.length, items: kept };
		}),

	discardFromBag: characterSessionProcedure
		.input(z.object({ itemIds: bagIds }))
		.mutation(async ({ ctx, input }) => {
			if (!ctx.character.inCamp) fail(DISCARD_CAMP_ONLY);
			const { id: characterId, currentZoneSession: zoneSession } =
				ctx.character;
			if (!zoneSession || input.itemIds.length === 0) return { discarded: 0 };

			const requested = new Set(input.itemIds);
			const discarded = (await loadBagIds(ctx.db, characterId)).filter((id) =>
				requested.has(id),
			);
			if (discarded.length === 0) return { discarded: 0 };
			await ctx.db
				.update(characters)
				.set({ zoneBag: removeFromBag(discarded) })
				.where(inZoneSession(characterId, zoneSession));
			return { discarded: discarded.length };
		}),

	discardFromInventory: characterSessionProcedure
		.input(z.object({ itemId }))
		.mutation(async ({ ctx, input }) => {
			const { id: characterId } = ctx.character;
			await loadInventoryItem(ctx.db, characterId, input.itemId);
			await ctx.db
				.delete(items)
				.where(inInventoryOf(characterId, input.itemId));
			return { discarded: 1 };
		}),

	equipItem: characterSessionProcedure
		.input(z.object({ itemId, targetSlot: equippedSlot }))
		.mutation(async ({ ctx, input }) => {
			const { character } = ctx;
			const [item, equipped, inventory] = await Promise.all([
				loadInventoryItem(ctx.db, character.id, input.itemId),
				loadEquipped(ctx.db, character.id),
				loadInventorySlots(ctx.db, character.id),
			]);
			const result = resolveEquip({
				character,
				item: item.data,
				targetSlot: input.targetSlot,
				equipped,
				inventoryUsed: inventory.length,
			});
			if (!result.ok) fail(result.error);

			const nextSlot = createInventorySlotAllocator(
				inventory.filter((row) => row.inventorySlot !== item.inventorySlot),
			);
			await ctx.db.batch([
				ctx.db
					.update(items)
					.set({
						locationKind: "equipped",
						equippedSlot: input.targetSlot,
						inventorySlot: null,
					})
					.where(inInventoryOf(character.id, item.id)),
				...result.displaced.map((d) =>
					ctx.db
						.update(items)
						.set({
							locationKind: "inventory",
							equippedSlot: null,
							inventorySlot: nextSlot(),
						})
						.where(equippedOf(character.id, d.id)),
				),
				ctx.db
					.update(characters)
					.set(computeStatCache(character, result.finalEquipped))
					.where(eq(characters.id, character.id)),
			]);
			return { equipped: 1, displaced: result.displaced.length };
		}),

	unequipItem: characterSessionProcedure
		.input(z.object({ slot: equippedSlot }))
		.mutation(async ({ ctx, input }) => {
			const { character } = ctx;
			const [equipped, inventory] = await Promise.all([
				loadEquipped(ctx.db, character.id),
				loadInventorySlots(ctx.db, character.id),
			]);
			const result = resolveUnequip({
				slot: input.slot,
				equipped,
				inventoryUsed: inventory.length,
			});
			if (!result.ok) fail(result.error);

			const nextSlot = createInventorySlotAllocator(inventory);
			await ctx.db.batch([
				ctx.db
					.update(characters)
					.set(computeStatCache(character, result.finalEquipped))
					.where(eq(characters.id, character.id)),
				...result.toInventory.map((row) =>
					ctx.db
						.update(items)
						.set({
							locationKind: "inventory",
							equippedSlot: null,
							inventorySlot: nextSlot(),
						})
						.where(equippedOf(character.id, row.id)),
				),
				...(result.promoted
					? [
							ctx.db
								.update(items)
								.set({ equippedSlot: "weapon" })
								.where(equippedOf(character.id, result.promoted.id)),
						]
					: []),
			]);
			return { unequipped: 1 };
		}),

	swapHands: characterSessionProcedure.mutation(async ({ ctx }) => {
		const { id: characterId } = ctx.character;
		const equipped = await loadEquipped(ctx.db, characterId);
		const main = equipped.find((e) => e.slot === "weapon");
		const off = equipped.find((e) => e.slot === "offhand");
		if (!main || !off) fail(SERVER_ERRORS.bothHandsRequired);
		if (!canSwapHands(main.item, off.item)) {
			fail(SERVER_ERRORS.handsNotInterchangeable);
		}
		await ctx.db.batch([
			ctx.db
				.update(items)
				.set({ equippedSlot: "offhand" })
				.where(equippedOf(characterId, main.id)),
			ctx.db
				.update(items)
				.set({ equippedSlot: "weapon" })
				.where(equippedOf(characterId, off.id)),
		]);
		return { swapped: 1 };
	}),

	reorderInventory: characterSessionProcedure
		.input(
			z.object({
				itemId,
				targetSlot: z.number().int(),
				swapWithItemId: itemId.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (input.targetSlot < 0 || input.targetSlot >= INVENTORY_MAX_SLOTS) {
				fail(`Invalid slot: ${input.targetSlot}`);
			}
			const { id: characterId } = ctx.character;
			const source = await loadInventoryItem(ctx.db, characterId, input.itemId);
			const swapWith = input.swapWithItemId;
			await ctx.db.batch([
				ctx.db
					.update(items)
					.set({ inventorySlot: input.targetSlot })
					.where(inInventoryOf(characterId, source.id)),
				...(swapWith !== undefined && swapWith !== source.id
					? [
							ctx.db
								.update(items)
								.set({ inventorySlot: source.inventorySlot ?? -1 })
								.where(
									and(
										inInventoryOf(characterId, swapWith),
										eq(items.inventorySlot, input.targetSlot),
									),
								),
						]
					: []),
			]);
		}),

	zoneBag: authedProcedure
		.input(characterIdInput)
		.query(async ({ ctx, input }) => {
			const row = await ctx.db.query.characters.findFirst({
				columns: { zoneBag: true },
				where: and(
					eq(characters.id, input.characterId),
					eq(characters.authUserId, ctx.session.user.id),
				),
			});
			return row?.zoneBag ?? [];
		}),

	inventory: authedProcedure
		.input(characterIdInput)
		.query(async ({ ctx, input }) =>
			ctx.db.query.items.findMany({
				where: and(
					inInventoryOf(input.characterId),
					eq(items.authUserId, ctx.session.user.id),
				),
				orderBy: [asc(items.inventorySlot), desc(items.droppedAt)],
			}),
		),

	equipped: authedProcedure
		.input(characterIdInput)
		.query(async ({ ctx, input }) =>
			ctx.db.query.items.findMany({
				where: and(
					equippedOf(input.characterId),
					eq(items.authUserId, ctx.session.user.id),
				),
			}),
		),

	stash: authedProcedure
		.input(z.object({ stashMode: z.enum(STASH_MODES) }))
		.query(async ({ ctx, input }) =>
			ctx.db.query.items.findMany({
				where: inStash(ctx.session.user.id, input.stashMode),
				orderBy: [asc(items.stashSlot), desc(items.droppedAt)],
			}),
		),
});
