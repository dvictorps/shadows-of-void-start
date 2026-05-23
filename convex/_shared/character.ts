import { ConvexError, v } from "convex/values"
import {
	COMBAT_PHASES,
	POTION_REFILL_FLOOR,
} from "../../src/game/combat/constants"
import { INVENTORY_MAX_SLOTS } from "../../src/game/inventory/constants"
import {
	EQUIPPED_SLOTS,
	type EquippedItem,
	narrowEquippedSlot,
} from "../../src/game/stats/types"
import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"

export async function loadOwnedCharacter(
	ctx: MutationCtx,
	authUserId: string,
	id: Id<"characters">,
): Promise<Doc<"characters">> {
	const char = await ctx.db.get(id)
	if (!char) throw new ConvexError("Character not found")
	if (char.authUserId !== authUserId) throw new ConvexError("Not your character")
	return char
}

export async function loadEquippedSet(
	ctx: MutationCtx,
	characterId: Id<"characters">,
): Promise<EquippedItem[]> {
	const equipped = await ctx.db
		.query("items")
		.withIndex("by_character_kind", (q) =>
			q.eq("characterId", characterId).eq("locationKind", "equipped"),
		)
		.collect()
	return equipped.flatMap((it) => {
		const slot = narrowEquippedSlot(it.equippedSlot)
		return slot ? [{ slot, item: it.data }] : []
	})
}

export async function deleteZoneBag(
	ctx: MutationCtx,
	zoneSession: string,
): Promise<void> {
	const bagItems = await ctx.db
		.query("items")
		.withIndex("by_zoneSession", (q) => q.eq("zoneSession", zoneSession))
		.collect()
	await Promise.all(bagItems.map((item) => ctx.db.delete(item._id)))
}

// Fetches the inventory in one pass and returns a slot allocator. The allocator
// mutates an internal occupied-set as it hands out slots — callers reuse the
// returned `inventory.length` for overflow checks instead of refetching.
export async function fetchInventoryAllocator(
	ctx: MutationCtx,
	characterId: Id<"characters">,
): Promise<{ used: number; nextFreeSlot: () => number }> {
	const inventory = await ctx.db
		.query("items")
		.withIndex("by_character_kind", (q) =>
			q.eq("characterId", characterId).eq("locationKind", "inventory"),
		)
		.collect()
	const occupied = new Set(
		inventory
			.map((it) => it.inventorySlot)
			.filter((s): s is number => typeof s === "number"),
	)
	function nextFreeSlot(): number {
		for (let i = 0; i < INVENTORY_MAX_SLOTS; i++) {
			if (!occupied.has(i)) {
				occupied.add(i)
				return i
			}
		}
		return -1
	}
	return { used: inventory.length, nextFreeSlot }
}

export function newZoneSession(): string {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// Patch fields that scope to a single zone visit — session id, time-bar
// origin, server-rolled camp thresholds, and the camp phase flag. Spread
// into `ctx.db.patch` whenever a visit ends (exitZone, useTeleportStone,
// respawnDead) so a new visit always starts from a clean slate without
// any one site forgetting a field.
export function clearPerVisitZoneState() {
	return {
		currentZoneSession: undefined,
		zoneStartedAt: undefined,
		campThresholdsMs: undefined,
		inCamp: false,
	} as const
}

// Append `item` to `list` if it's not already present. Returns the same
// reference when no change is needed so callers can `if (next === list)
// skip update`. Used for `unlockedNodes` and similar append-only sets
// where the list grows monotonically across the character's lifetime.
export function appendUnique<T>(list: T[], item: T): T[] {
	return list.includes(item) ? list : [...list, item]
}

// City-only mutations (vendor purchases/sales today, stash later) require the
// character to be physically at the city — not in a zone, not in transit.
// The UI gates this via the city scene's affordances; this is the server-side
// equivalent guard that direct mutation calls also hit.
export function assertInCity(char: Doc<"characters">): void {
	const location = char.currentLocation ?? "city"
	if (location !== "city")
		throw new ConvexError("Must be in the city")
	if (char.travelDestination !== undefined)
		throw new ConvexError("Cannot do this while travelling")
}

// City-safety potion refill — reaching a safe state (manual return to city,
// teleport-stone-to-city arrival, softcore respawn) tops the carried potion
// count up to POTION_REFILL_FLOOR. Player keeps anything ≥ the floor; only
// the gap is filled. Centralised so a future tuning pass touches one place.
export function refillPotionsToFloor(char: Doc<"characters">): number {
	return Math.max(char.potions ?? 0, POTION_REFILL_FLOOR)
}

// Derived from the single source of truth in src/game/stats/types so the
// validator and the EquippedSlot type can never drift.
export const equippedSlotValidator = v.union(
	v.literal(EQUIPPED_SLOTS[0]),
	v.literal(EQUIPPED_SLOTS[1]),
	v.literal(EQUIPPED_SLOTS[2]),
	v.literal(EQUIPPED_SLOTS[3]),
	v.literal(EQUIPPED_SLOTS[4]),
	v.literal(EQUIPPED_SLOTS[5]),
	v.literal(EQUIPPED_SLOTS[6]),
	v.literal(EQUIPPED_SLOTS[7]),
	v.literal(EQUIPPED_SLOTS[8]),
	v.literal(EQUIPPED_SLOTS[9]),
)

// Derived from the single source of truth in src/game/combat/constants so
// the validator and the CombatPhase type can never drift.
export const combatPhaseValidator = v.union(
	v.literal(COMBAT_PHASES[0]),
	v.literal(COMBAT_PHASES[1]),
	v.literal(COMBAT_PHASES[2]),
)
