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
import { type EquippedItem, narrowEquippedSlot } from "../src/game/stats/types"
import {
	clearPerVisitZoneState,
	equippedSlotValidator,
	fetchInventoryAllocator,
	loadOwnedCharacterWithSession,
} from "./_shared/character"
import type { Doc } from "./_generated/dataModel"
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
function derivePhaseFromCharacter(char: Doc<"characters">): CombatPhase {
	return char.inCamp ? "camp" : "combat"
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
		const derivedPhase = derivePhaseFromCharacter(char)

		const zoneSession = char.currentZoneSession
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

		// Non-camp exit: 30% cap on items kept (see RETENTION_CAP_FRACTION).
		// Client mirrors this computation via the same helper, but the server
		// is authoritative — a tampered client can't widen its share.
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

		await ctx.db.patch(args.characterId, clearPerVisitZoneState())
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
		const derivedPhase = derivePhaseFromCharacter(char)

		if (derivedPhase !== "camp") {
			throw new ConvexError(
				`pickFromBag is camp-only — phase ${derivedPhase} must commit via exitZone`,
			)
		}

		const zoneSession = char.currentZoneSession
		if (!zoneSession || args.itemIds.length === 0) return { kept: 0 }

		const idSet = new Set(args.itemIds.map((id) => id.toString()))
		const bagItems = await ctx.db
			.query("items")
			.withIndex("by_zoneSession", (q) => q.eq("zoneSession", zoneSession))
			.collect()
		const valid = bagItems.filter(
			(it) =>
				idSet.has(it._id.toString()) && it.characterId === args.characterId,
		)

		const { used, nextFreeSlot } = await fetchInventoryAllocator(
			ctx,
			args.characterId,
		)
		if (used + valid.length > INVENTORY_MAX_SLOTS) {
			throw new ConvexError(
				`Inventory overflow: ${used + valid.length} > ${INVENTORY_MAX_SLOTS}`,
			)
		}

		const assignments = valid.map((it) => ({
			id: it._id,
			slot: nextFreeSlot(),
		}))
		await Promise.all(
			assignments.map((a) =>
				ctx.db.patch(a.id, {
					locationKind: "inventory" as const,
					zoneSession: undefined,
					inventorySlot: a.slot,
				}),
			),
		)
		return { kept: valid.length }
	},
})

/**
 * Delete a subset of zone-bag items. Session stays alive. Camp-only —
 * shrinking the bag in non-camp would let the player game the 30% cap
 * (smaller bag = smaller absolute discard ceiling). Non-camp exits commit
 * via exitZone, which discards everything not in keepIds atomically.
 */
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
		const derivedPhase = derivePhaseFromCharacter(char)

		if (derivedPhase !== "camp") {
			throw new ConvexError(
				`discardFromBag is camp-only — phase ${derivedPhase} must commit via exitZone`,
			)
		}

		const zoneSession = char.currentZoneSession
		if (!zoneSession || args.itemIds.length === 0) return { discarded: 0 }

		const idSet = new Set(args.itemIds.map((id) => id.toString()))
		const bagItems = await ctx.db
			.query("items")
			.withIndex("by_zoneSession", (q) => q.eq("zoneSession", zoneSession))
			.collect()
		const toDelete = bagItems.filter(
			(it) =>
				idSet.has(it._id.toString()) && it.characterId === args.characterId,
		)
		await Promise.all(toDelete.map((it) => ctx.db.delete(it._id)))
		return { discarded: toDelete.length }
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
		await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)

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

		// Find any item currently sitting on the target slot.
		const allInv = await ctx.db
			.query("items")
			.withIndex("by_character_kind", (q) =>
				q.eq("characterId", args.characterId).eq("locationKind", "inventory"),
			)
			.collect()
		const occupant = allInv.find((it) => it.inventorySlot === args.targetSlot)

		const sourceSlot = source.inventorySlot
		await ctx.db.patch(source._id, { inventorySlot: args.targetSlot })
		if (occupant && occupant._id !== source._id) {
			await ctx.db.patch(occupant._id, { inventorySlot: sourceSlot ?? -1 })
		}
	},
})

// Query: items in the current zone bag (for the preview/exit modals).
export const zoneBag = query({
	args: { characterId: v.id("characters") },
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) return []
		const char = await ctx.db.get(args.characterId)
		if (!char || char.authUserId !== authUser._id) return []
		const zoneSession = char.currentZoneSession
		if (!zoneSession) return []
		return await ctx.db
			.query("items")
			.withIndex("by_zoneSession", (q) => q.eq("zoneSession", zoneSession))
			.collect()
	},
})

// Query: inventory items for a character. Returned in slot order so the
// client can map slot→item directly.
export const inventory = query({
	args: { characterId: v.id("characters") },
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) return []
		const char = await ctx.db.get(args.characterId)
		if (!char || char.authUserId !== authUser._id) return []
		const items = await ctx.db
			.query("items")
			.withIndex("by_character_kind", (q) =>
				q.eq("characterId", args.characterId).eq("locationKind", "inventory"),
			)
			.collect()
		return items.sort((a, b) => {
			const sa = a.inventorySlot ?? Number.MAX_SAFE_INTEGER
			const sb = b.inventorySlot ?? Number.MAX_SAFE_INTEGER
			if (sa !== sb) return sa - sb
			return b.droppedAt - a.droppedAt
		})
	},
})

// Query: a character's currently equipped items (just weapon for now).
export const equipped = query({
	args: { characterId: v.id("characters") },
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) return []
		const char = await ctx.db.get(args.characterId)
		if (!char || char.authUserId !== authUser._id) return []
		return await ctx.db
			.query("items")
			.withIndex("by_character_kind", (q) =>
				q.eq("characterId", args.characterId).eq("locationKind", "equipped"),
			)
			.collect()
	},
})
