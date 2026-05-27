// ─────────────────────────────────────────────────────────────────────────────
//  Item lifecycle mutations + queries. The items table is the single source of
//  truth for item ownership; the character document caches only equip slot
//  pointers. Transitions: zoneBag → inventory → equipped (and back), plus
//  permanent discards.
//
//  Mutations:
//    exitZone              ← bag → inventory (kept) / delete (discarded)
//    pickFromBag           ← single item bag → inventory
//    discardFromBag        ← permanent delete of a staged drop
//    discardFromInventory  ← permanent delete of an inventory item
//    equipItem             ← runs planEquip + requirements check + displacement
//    unequipItem           ← equipped → inventory (+ auto-displaces orphan quivers)
//    reorderInventory      ← swap two inventory slots
//
//  Queries:
//    zoneBag, inventory, equipped — by characterId
// ─────────────────────────────────────────────────────────────────────────────

import { ConvexError, v } from "convex/values"
import { findClassDefinition } from "../src/game/classes/data"
import {
	type CombatPhase,
	computeBagKeepCap,
} from "../src/game/combat/constants"
import { INVENTORY_MAX_SLOTS } from "../src/game/inventory/constants"
import { isBow, isQuiver, isWeapon, planEquip } from "../src/game/items/equipment"
import { computeCharacterStats } from "../src/game/stats/compute"
import { type EquippedItem, type EquippedSlot, narrowEquippedSlot } from "../src/game/stats/types"
import {
	cacheStatsFromEquipped,
	clearCombatZoneState,
	equippedSlotValidator,
	fetchInventoryAllocator,
	loadOrCreateCombatState,
	loadOwnedCharacterWithSession,
} from "./_shared/character"
import { mutation, query } from "./_generated/server"
import { authComponent } from "./auth"

// Server-authoritative phase derivation — bag mutations consult
// `char.inCamp` rather than trusting a client-supplied value, so a tampered
// client can't widen its retention share.
//
// Intentional simplification: `CombatPhase` distinguishes "combat" vs
// "exploration" (see src/game/combat/constants.ts), but the server doesn't
// track which of the two the player is in — and both share the 30% retention
// cap. Returning "combat" as the catch-all keeps the cap computation correct
// today. If future logic ever needs the distinction (analytics, phase-gated
// mechanics), the character doc has to gain a real phase field first.
function derivePhaseFromCombatState(cs: { inCamp: boolean }): CombatPhase {
	return cs.inCamp ? "camp" : "combat"
}

export const exitZone = mutation({
	args: {
		characterId: v.id("characters"),
		sessionToken: v.string(),
		keepIds: v.array(v.id("items")),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)
		const cs = await loadOrCreateCombatState(ctx, args.characterId, char)
		const derivedPhase = derivePhaseFromCombatState(cs)

		const zoneSession = cs.currentZoneSession
		if (!zoneSession) return { kept: 0, discarded: 0 }

		const bagItems = await ctx.db
			.query("items")
			.withIndex("by_zoneSession", (q) => q.eq("zoneSession", zoneSession))
			.collect()

		const keepSet = new Set(args.keepIds.map((id) => id.toString()))
		const validKeeps = bagItems.filter(
			(it) =>
				keepSet.has(it._id.toString()) && it.characterId === args.characterId,
		)

		const cap = computeBagKeepCap(bagItems.length, derivedPhase)
		if (derivedPhase !== "camp" && validKeeps.length > cap) {
			throw new ConvexError(
				`Phase cap exceeded: kept ${validKeeps.length} > cap ${cap} for phase ${derivedPhase}`,
			)
		}

		const { used, nextFreeSlot } = await fetchInventoryAllocator(
			ctx,
			args.characterId,
		)
		if (used + validKeeps.length > INVENTORY_MAX_SLOTS) {
			throw new ConvexError(
				`Inventory overflow: ${used + validKeeps.length} > ${INVENTORY_MAX_SLOTS}`,
			)
		}

		const keepSetById = new Set(validKeeps.map((it) => it._id))
		const slotAssignments = validKeeps.map((it) => ({
			id: it._id,
			slot: nextFreeSlot(),
		}))
		const toDelete = bagItems.filter((it) => !keepSetById.has(it._id))

		await Promise.all([
			...slotAssignments.map((a) =>
				ctx.db.patch(a.id, {
					locationKind: "inventory" as const,
					zoneSession: undefined,
					inventorySlot: a.slot,
				}),
			),
			...toDelete.map((it) => ctx.db.delete(it._id)),
		])

		await ctx.db.patch(cs._id, clearCombatZoneState())
		return { kept: validKeeps.length, discarded: toDelete.length }
	},
})

/**
 * Move a subset of zone-bag items to inventory while keeping the session alive.
 * Validates ownership + inventory overflow. Camp-only — non-camp exits must
 * route through `exitZone` so the 30% cap is enforced atomically.
 */
export const pickFromBag = mutation({
	args: {
		characterId: v.id("characters"),
		sessionToken: v.string(),
		itemIds: v.array(v.id("items")),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)
		const cs = await loadOrCreateCombatState(ctx, args.characterId, char)
		if (!cs.inCamp) {
			throw new ConvexError(
				"pickFromBag is camp-only — must commit via exitZone",
			)
		}

		const zoneSession = cs.currentZoneSession
		if (!zoneSession || args.itemIds.length === 0) return { kept: 0 }

		const { used, nextFreeSlot } = await fetchInventoryAllocator(ctx, args.characterId)
		let kept = 0
		for (const itemId of args.itemIds) {
			const item = await ctx.db.get(itemId)
			if (!item || item.characterId !== args.characterId || item.zoneSession !== zoneSession) continue
			if (used + kept + 1 > INVENTORY_MAX_SLOTS) break
			await ctx.db.patch(itemId, {
				locationKind: "inventory" as const,
				zoneSession: undefined,
				inventorySlot: nextFreeSlot(),
			})
			kept++
		}
		return { kept }
	},
})

export const discardFromBag = mutation({
	args: {
		characterId: v.id("characters"),
		sessionToken: v.string(),
		itemIds: v.array(v.id("items")),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)
		const cs = await loadOrCreateCombatState(ctx, args.characterId, char)
		if (!cs.inCamp) {
			throw new ConvexError(
				"discardFromBag is camp-only — must commit via exitZone",
			)
		}

		const zoneSession = cs.currentZoneSession
		if (!zoneSession || args.itemIds.length === 0) return { discarded: 0 }

		let discarded = 0
		for (const itemId of args.itemIds) {
			const item = await ctx.db.get(itemId)
			if (!item || item.characterId !== args.characterId || item.zoneSession !== zoneSession) continue
			await ctx.db.delete(itemId)
			discarded++
		}
		return { discarded }
	},
})

/**
 * Permanently delete an inventory item. Rejects equipped items — the caller
 * must unequip first (mirrors the vendor sell rule).
 */
export const discardFromInventory = mutation({
	args: {
		characterId: v.id("characters"),
		sessionToken: v.string(),
		itemId: v.id("items"),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)

		const item = await ctx.db.get(args.itemId)
		if (!item) throw new ConvexError("Item not found")
		if (item.characterId !== args.characterId)
			throw new ConvexError("Not your item")
		if (item.locationKind !== "inventory")
			throw new ConvexError("Item is not in inventory")

		await ctx.db.delete(args.itemId)
		return { discarded: 1 }
	},
})

/**
 * Move an inventory item into an equipment slot. Validates slot eligibility,
 * 2H/off-hand interactions, same-archetype dual-wield, and equip-time
 * requirements (level + attributes against totals excluding the new item).
 * Displaced items return to inventory; rejects if the resulting inventory
 * would overflow.
 */
export const equipItem = mutation({
	args: {
		characterId: v.id("characters"),
		sessionToken: v.string(),
		itemId: v.id("items"),
		targetSlot: equippedSlotValidator,
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)

		const item = await ctx.db.get(args.itemId)
		if (!item) throw new ConvexError("Item not found")
		if (item.characterId !== args.characterId)
			throw new ConvexError("Not your item")
		if (item.locationKind !== "inventory")
			throw new ConvexError("Item is not in inventory")

		const currentlyEquipped = await ctx.db
			.query("items")
			.withIndex("by_character_kind", (q) =>
				q
					.eq("characterId", args.characterId)
					.eq("locationKind", "equipped"),
			)
			.collect()

		const currentEquippedSet = currentlyEquipped.flatMap((it) => {
			const slot = narrowEquippedSlot(it.equippedSlot)
			return slot ? [{ slot, item: it.data, _id: it._id }] : []
		})

		const plan = planEquip({
			item: item.data,
			targetSlot: args.targetSlot,
			currentEquipped: currentEquippedSet,
		})
		if (plan.reject) {
			throw new ConvexError(`Cannot equip: ${plan.reject}`)
		}

		// Requirements check: compute stats with (post-displacement set minus the
		// new item). If the new item's reqs aren't met against those totals, the
		// equip-time strict check fails (item's own contribution doesn't help).
		const displacedIds = new Set(plan.displaced.map((d) => `${d.slot}`))
		const newSetMinusNewItem: EquippedItem[] = currentEquippedSet
			.filter(
				(eq) =>
					eq.slot !== args.targetSlot && !displacedIds.has(`${eq.slot}`),
			)
			.map((eq) => ({ slot: eq.slot, item: eq.item }))
		const classDef = findClassDefinition(char.classId)
		const stats = computeCharacterStats({
			classDef,
			level: char.level,
			equippedItems: newSetMinusNewItem,
		})
		const reqs = item.data.requirements
		if (reqs) {
			if (reqs.level !== undefined && char.level < reqs.level)
				throw new ConvexError(`Level ${reqs.level} required`)
			if (reqs.str !== undefined && stats.attributes.strength < reqs.str)
				throw new ConvexError(`Strength ${reqs.str} required`)
			if (reqs.dex !== undefined && stats.attributes.dexterity < reqs.dex)
				throw new ConvexError(`Dexterity ${reqs.dex} required`)
			if (reqs.int !== undefined && stats.attributes.intelligence < reqs.int)
				throw new ConvexError(`Intelligence ${reqs.int} required`)
		}

		// Inventory overflow: source item leaves (-1), displaced items return.
		const { used, nextFreeSlot } = await fetchInventoryAllocator(
			ctx,
			args.characterId,
		)
		const finalUsed = used - 1 + plan.displaced.length
		if (finalUsed > INVENTORY_MAX_SLOTS) {
			throw new ConvexError("Inventory overflow — free a slot first")
		}

		// Map displaced docs back to db ids for patching.
		const docsBySlot = new Map(
			currentlyEquipped.map((it) => [it.equippedSlot, it]),
		)
		await Promise.all([
			ctx.db.patch(item._id, {
				locationKind: "equipped" as const,
				equippedSlot: args.targetSlot,
				inventorySlot: undefined,
			}),
			...plan.displaced.map((d) => {
				const doc = docsBySlot.get(d.slot)
				if (!doc) return Promise.resolve()
				return ctx.db.patch(doc._id, {
					locationKind: "inventory" as const,
					equippedSlot: undefined,
					inventorySlot: nextFreeSlot(),
				})
			}),
		])

		const finalEquipped: EquippedItem[] = [
			...newSetMinusNewItem,
			{ slot: args.targetSlot as EquippedSlot, item: item.data },
		]
		await cacheStatsFromEquipped(ctx, args.characterId, char, finalEquipped)

		return { equipped: 1, displaced: plan.displaced.length }
	},
})

/**
 * Move an equipped item back to inventory. Rejects if inventory has no room.
 */
export const unequipItem = mutation({
	args: {
		characterId: v.id("characters"),
		sessionToken: v.string(),
		slot: equippedSlotValidator,
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)

		const equipped = await ctx.db
			.query("items")
			.withIndex("by_character_kind", (q) =>
				q
					.eq("characterId", args.characterId)
					.eq("locationKind", "equipped"),
			)
			.collect()
		const item = equipped.find((it) => it.equippedSlot === args.slot)
		if (!item) throw new ConvexError("Slot is empty")

		// Bow leaving the main hand orphans any quiver in the off-hand. Capture
		// it now so we displace it to inventory in the same transaction.
		const orphanQuiver =
			args.slot === "weapon" && isBow(item.data)
				? equipped.find(
						(it) => it.equippedSlot === "offhand" && isQuiver(it.data),
					)
				: undefined

		// Invariant: if main hand is empty, off-hand cannot hold a weapon.
		// Capture the off-hand weapon now, before any patches, so the promotion
		// below operates on a clean pre-mutation snapshot.
		const offhandToPromote =
			args.slot === "weapon" && !orphanQuiver
				? equipped.find(
						(it) => it.equippedSlot === "offhand" && isWeapon(it.data),
					)
				: undefined

		const { used, nextFreeSlot } = await fetchInventoryAllocator(
			ctx,
			args.characterId,
		)
		const slotsNeeded = 1 + (orphanQuiver ? 1 : 0)
		if (used + slotsNeeded > INVENTORY_MAX_SLOTS) {
			throw new ConvexError("Inventory full — free a slot first")
		}
		await ctx.db.patch(item._id, {
			locationKind: "inventory" as const,
			equippedSlot: undefined,
			inventorySlot: nextFreeSlot(),
		})

		if (orphanQuiver) {
			await ctx.db.patch(orphanQuiver._id, {
				locationKind: "inventory" as const,
				equippedSlot: undefined,
				inventorySlot: nextFreeSlot(),
			})
		} else if (offhandToPromote) {
			await ctx.db.patch(offhandToPromote._id, {
				equippedSlot: "weapon" as const,
			})
		}

		const finalEquipped: EquippedItem[] = equipped.flatMap((it) => {
			const s = narrowEquippedSlot(it.equippedSlot)
			if (!s) return []
			if (it._id === item._id) return []
			if (orphanQuiver && it._id === orphanQuiver._id) return []
			if (offhandToPromote && it._id === offhandToPromote._id) {
				return [{ slot: "weapon" as EquippedSlot, item: it.data }]
			}
			return [{ slot: s, item: it.data }]
		})
		await cacheStatsFromEquipped(ctx, args.characterId, char, finalEquipped)

		return { unequipped: 1 }
	},
})

/**
 * Reorder an item within the inventory grid. If `targetSlot` is occupied,
 * the items swap positions; otherwise the source item just moves.
 */
export const reorderInventory = mutation({
	args: {
		characterId: v.id("characters"),
		sessionToken: v.string(),
		itemId: v.id("items"),
		targetSlot: v.number(),
		swapWithItemId: v.optional(v.id("items")),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)

		if (args.targetSlot < 0 || args.targetSlot >= INVENTORY_MAX_SLOTS) {
			throw new ConvexError(`Invalid slot: ${args.targetSlot}`)
		}

		const source = await ctx.db.get(args.itemId)
		if (!source) throw new ConvexError("Item not found")
		if (source.characterId !== args.characterId)
			throw new ConvexError("Not your item")
		if (source.locationKind !== "inventory")
			throw new ConvexError("Item is not in inventory")

		const sourceSlot = source.inventorySlot
		await ctx.db.patch(source._id, { inventorySlot: args.targetSlot })

		if (args.swapWithItemId) {
			const occupant = await ctx.db.get(args.swapWithItemId)
			if (occupant && occupant._id !== source._id
				&& occupant.characterId === args.characterId
				&& occupant.locationKind === "inventory") {
				await ctx.db.patch(occupant._id, { inventorySlot: sourceSlot ?? -1 })
			}
		}
	},
})

// Query: items in the current zone bag (for the preview/exit modals).
// Takes zoneSession directly so the query doesn't read the character
// document — avoids reactive invalidation on every recordKill/syncHp patch.
export const zoneBag = query({
	args: { zoneSession: v.string() },
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) return []
		const items = await ctx.db
			.query("items")
			.withIndex("by_zoneSession", (q) => q.eq("zoneSession", args.zoneSession))
			.collect()
		if (items.length > 0 && items[0].authUserId !== authUser._id) return []
		return items
	},
})

// Query: inventory items for a character. Returned in slot order so the
// client can map slot→item directly.
// Ownership verified via items' authUserId instead of reading the character
// document — avoids reactive invalidation on every recordKill/syncHp patch.
export const inventory = query({
	args: { characterId: v.id("characters") },
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) return []
		const items = await ctx.db
			.query("items")
			.withIndex("by_character_kind", (q) =>
				q.eq("characterId", args.characterId).eq("locationKind", "inventory"),
			)
			.collect()
		if (items.length > 0 && items[0].authUserId !== authUser._id) return []
		return items.sort((a, b) => {
			const sa = a.inventorySlot ?? Number.MAX_SAFE_INTEGER
			const sb = b.inventorySlot ?? Number.MAX_SAFE_INTEGER
			if (sa !== sb) return sa - sb
			return b.droppedAt - a.droppedAt
		})
	},
})

// Query: a character's currently equipped items.
// Ownership verified via items' authUserId instead of reading the character
// document — avoids reactive invalidation on every recordKill/syncHp patch.
export const equipped = query({
	args: { characterId: v.id("characters") },
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) return []
		const items = await ctx.db
			.query("items")
			.withIndex("by_character_kind", (q) =>
				q.eq("characterId", args.characterId).eq("locationKind", "equipped"),
			)
			.collect()
		if (items.length > 0 && items[0].authUserId !== authUser._id) return []
		return items
	},
})

// Query: stash items for the current user's active mode.
// Account-scoped (shared across characters in the same mode).
// Takes stashMode directly so the query doesn't read the character
// document — avoids reactive invalidation on every recordKill/syncHp patch.
export const stash = query({
	args: { stashMode: v.union(v.literal("softcore"), v.literal("hardcore")) },
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) return []
		const items = await ctx.db
			.query("items")
			.withIndex("by_stash", (q) =>
				q.eq("authUserId", authUser._id).eq("stashMode", args.stashMode),
			)
			.collect()
		return items.sort((a, b) => {
			const sa = a.stashSlot ?? Number.MAX_SAFE_INTEGER
			const sb = b.stashSlot ?? Number.MAX_SAFE_INTEGER
			if (sa !== sb) return sa - sb
			return b.droppedAt - a.droppedAt
		})
	},
})
