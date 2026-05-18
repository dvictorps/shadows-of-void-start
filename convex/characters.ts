import { ConvexError, v } from "convex/values"
import {
	CLASS_DEFINITIONS,
	findClassDefinition,
} from "../src/game/classes/data"
import type { CharacterClassId } from "../src/game/classes/types"
import { POTION_HEAL_FRACTION } from "../src/game/combat/constants"
import { INVENTORY_MAX_SLOTS } from "../src/game/inventory/constants"
import { planEquip } from "../src/game/items/equipment"
import { findStarterItem, STARTER_WEAPON_BY_CLASS } from "../src/game/items/starter-gear"
import { rollDrop, rollMonsterLevel } from "../src/game/loot/drops"
import { findMonster } from "../src/game/monsters/data"
import { computeCharacterStats } from "../src/game/stats/compute"
import {
	EQUIPPED_SLOTS,
	type EquippedItem,
	narrowEquippedSlot,
} from "../src/game/stats/types"
import {
	applyDeathXpPenalty,
	applyXpGain,
} from "../src/game/progression/levels"
import type { Doc, Id } from "./_generated/dataModel"
import { mutation, type MutationCtx, query } from "./_generated/server"
import { authComponent } from "./auth"
import { ACT_1, findNode } from "../src/game/world"

const MAX_CHARACTERS_PER_USER = 8
const MAX_NAME_LENGTH = 20
const STARTING_POTIONS = 5

function isKnownClassId(id: string): id is CharacterClassId {
	return Object.hasOwn(CLASS_DEFINITIONS, id)
}

function defaultStarterWeapon(classId: string): string | undefined {
	return isKnownClassId(classId) ? STARTER_WEAPON_BY_CLASS[classId] : undefined
}

function normalize(char: Doc<"characters">) {
	const classDef = findClassDefinition(char.classId)
	return {
		xp: char.xp ?? 0,
		hpCurrent: char.hpCurrent ?? (classDef?.baseStats.hp ?? 50),
		potions: char.potions ?? 0,
		hardcore: char.hardcore ?? false,
		equippedWeaponId: char.equippedWeaponId,
		currentZoneSession: char.currentZoneSession,
	}
}

function newZoneSession(): string {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

async function loadOwnedCharacter(
	ctx: MutationCtx,
	authUserId: string,
	id: Id<"characters">,
): Promise<Doc<"characters">> {
	const char = await ctx.db.get(id)
	if (!char) throw new ConvexError("Character not found")
	if (char.authUserId !== authUserId) throw new ConvexError("Not your character")
	return char
}

async function loadEquippedSet(
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

async function deleteZoneBag(
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
async function fetchInventoryAllocator(
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

// ── Character CRUD ──

export const list = query({
	args: {},
	handler: async (ctx) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) return []
		const docs = await ctx.db
			.query("characters")
			.withIndex("by_authUserId", (q) => q.eq("authUserId", authUser._id))
			.order("desc")
			.collect()
		return docs.map((char) => ({ ...char, ...normalize(char) }))
	},
})

export const create = mutation({
	args: {
		name: v.string(),
		classId: v.string(),
		hardcore: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")

		if (!isKnownClassId(args.classId)) {
			throw new ConvexError(`Unknown class: ${args.classId}`)
		}

		const name = args.name.trim()
		if (name.length === 0) throw new ConvexError("Name cannot be empty")
		if (name.length > MAX_NAME_LENGTH)
			throw new ConvexError(
				`Name must be at most ${MAX_NAME_LENGTH} characters`,
			)

		const existing = await ctx.db
			.query("characters")
			.withIndex("by_authUserId", (q) => q.eq("authUserId", authUser._id))
			.collect()

		if (existing.length >= MAX_CHARACTERS_PER_USER) {
			throw new ConvexError(
				`Max ${MAX_CHARACTERS_PER_USER} characters per account`,
			)
		}

		const nameLower = name.toLowerCase()
		if (existing.some((c) => c.name.toLowerCase() === nameLower)) {
			throw new ConvexError("You already have a character with this name")
		}

		const classDef = findClassDefinition(args.classId)
		const baseStats = computeCharacterStats({
			classDef,
			level: 1,
			equippedItems: [],
		})
		const maxHp = baseStats.maxLife
		const starterWeaponId = defaultStarterWeapon(args.classId)

		const characterId = await ctx.db.insert("characters", {
			authUserId: authUser._id,
			name,
			classId: args.classId,
			level: 1,
			xp: 0,
			hpCurrent: maxHp,
			potions: STARTING_POTIONS,
			hardcore: args.hardcore ?? false,
			createdAt: Date.now(),
		})

		// Create the starter item entry in the items table so equip lifecycle is
		// consistent from day one (no special-casing later when equip/unequip lands).
		if (starterWeaponId) {
			const starterDef = findStarterItem(starterWeaponId)
			if (starterDef) {
				const itemId = await ctx.db.insert("items", {
					authUserId: authUser._id,
					locationKind: "equipped",
					characterId,
					equippedSlot: "weapon",
					data: starterDef,
					droppedAt: Date.now(),
					droppedFrom: "starter",
				})
				await ctx.db.patch(characterId, { equippedWeaponId: itemId })
			}
		}

		return characterId
	},
})

export const remove = mutation({
	args: { id: v.id("characters") },
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")

		const char = await ctx.db.get(args.id)
		if (!char) throw new ConvexError("Character not found")
		if (char.authUserId !== authUser._id)
			throw new ConvexError("Not your character")

		// Cascade: delete all items owned by this character (inventory, equipped, zoneBag).
		// Stash is account-wide so we leave it.
		const ownedItems = await ctx.db
			.query("items")
			.withIndex("by_character_kind", (q) => q.eq("characterId", args.id))
			.collect()
		await Promise.all(ownedItems.map((item) => ctx.db.delete(item._id)))

		await ctx.db.delete(args.id)
	},
})

export const byId = query({
	args: { id: v.id("characters") },
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) return null
		const char = await ctx.db.get(args.id)
		if (!char) return null
		if (char.authUserId !== authUser._id) return null
		return { ...char, ...normalize(char) }
	},
})

// ── Combat mutations ──

export const recordKill = mutation({
	args: {
		characterId: v.id("characters"),
		monsterId: v.string(),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacter(ctx, authUser._id, args.characterId)

		const monster = findMonster(args.monsterId)
		if (!monster) throw new ConvexError(`Unknown monster: ${args.monsterId}`)

		const { level, xp, levelsGained } = applyXpGain(
			char.level,
			char.xp ?? 0,
			monster.xpReward,
		)

		const updates: Partial<Doc<"characters">> = { level, xp }

		if (levelsGained > 0) {
			const classDef = findClassDefinition(char.classId)
			const equippedItems = await loadEquippedSet(ctx, args.characterId)
			const stats = computeCharacterStats({
				classDef,
				level,
				equippedItems,
			})
			updates.hpCurrent = stats.maxLife
		}
		await ctx.db.patch(args.characterId, updates)

		// Roll the drop server-side, persist in the zone bag.
		const zoneSession = char.currentZoneSession
		const drops: Array<{ id: Id<"items">; data: Doc<"items">["data"] }> = []
		if (zoneSession) {
			const monsterLevel = rollMonsterLevel(1) // For MVP all goblins ride zone 1; future: pass zone.level via arg
			const drop = rollDrop({
				monsterRarity: "normal",
				monsterLevel,
			})
			if (drop) {
				const insertedId = await ctx.db.insert("items", {
					authUserId: authUser._id,
					locationKind: "zoneBag",
					characterId: args.characterId,
					zoneSession,
					data: drop,
					droppedAt: Date.now(),
					droppedFrom: monster.id,
					droppedFromLevel: monsterLevel,
				})
				drops.push({ id: insertedId, data: drop })
			}
		}

		return { xpGained: monster.xpReward, levelsGained, drops }
	},
})

export const usePotion = mutation({
	args: { characterId: v.id("characters") },
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacter(ctx, authUser._id, args.characterId)

		const potions = char.potions ?? 0
		if (potions <= 0) throw new ConvexError("No potions to use")

		const classDef = findClassDefinition(char.classId)
		const equippedItems = await loadEquippedSet(ctx, args.characterId)
		const stats = computeCharacterStats({
			classDef,
			level: char.level,
			equippedItems,
		})
		const maxHp = stats.maxLife
		const currentHp = char.hpCurrent ?? maxHp
		if (currentHp >= maxHp) throw new ConvexError("Already at full HP")

		const healed = Math.min(
			maxHp,
			currentHp + Math.floor(maxHp * POTION_HEAL_FRACTION),
		)
		await ctx.db.patch(args.characterId, {
			hpCurrent: healed,
			potions: potions - 1,
		})
		return { hpCurrent: healed, potions: potions - 1 }
	},
})

export const syncHp = mutation({
	args: {
		characterId: v.id("characters"),
		hpCurrent: v.number(),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacter(ctx, authUser._id, args.characterId)

		const classDef = findClassDefinition(char.classId)
		const equippedItems = await loadEquippedSet(ctx, args.characterId)
		const stats = computeCharacterStats({
			classDef,
			level: char.level,
			equippedItems,
		})
		const maxHp = stats.maxLife
		const clamped = Math.max(0, Math.min(maxHp, Math.floor(args.hpCurrent)))

		await ctx.db.patch(args.characterId, { hpCurrent: clamped })
		return { hpCurrent: clamped }
	},
})

export const enterCity = mutation({
	args: { characterId: v.id("characters") },
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacter(ctx, authUser._id, args.characterId)

		const classDef = findClassDefinition(char.classId)
		const equippedItems = await loadEquippedSet(ctx, args.characterId)
		const stats = computeCharacterStats({
			classDef,
			level: char.level,
			equippedItems,
		})
		const maxHp = stats.maxLife
		const potions = char.potions ?? 0
		const refilledPotions = potions === 0 ? 1 : potions

		await ctx.db.patch(args.characterId, {
			hpCurrent: maxHp,
			potions: refilledPotions,
		})
		return { hpCurrent: maxHp, potions: refilledPotions }
	},
})

export const respawnDead = mutation({
	args: { characterId: v.id("characters") },
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacter(ctx, authUser._id, args.characterId)

		// Wipe the zone bag — death loses everything staged.
		if (char.currentZoneSession) {
			await deleteZoneBag(ctx, char.currentZoneSession)
		}

		if (char.hardcore) {
			// Cascade item delete then character delete (mirrors `remove`).
			const ownedItems = await ctx.db
				.query("items")
				.withIndex("by_character_kind", (q) =>
					q.eq("characterId", args.characterId),
				)
				.collect()
			await Promise.all(ownedItems.map((item) => ctx.db.delete(item._id)))
			await ctx.db.delete(args.characterId)
			return { mode: "hardcore" as const, xpLost: 0 }
		}

		const { xp, xpLost } = applyDeathXpPenalty(char.xp ?? 0)
		const classDef = findClassDefinition(char.classId)
		const equippedItems = await loadEquippedSet(ctx, args.characterId)
		const stats = computeCharacterStats({
			classDef,
			level: char.level,
			equippedItems,
		})
		const maxHp = stats.maxLife

		await ctx.db.patch(args.characterId, {
			hpCurrent: maxHp,
			xp,
			currentZoneSession: undefined,
		})
		return { mode: "softcore" as const, xpLost }
	},
})

// ── Zone session lifecycle ──

export const enterZone = mutation({
	args: {
		characterId: v.id("characters"),
		zoneId: v.string(),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacter(ctx, authUser._id, args.characterId)

		const zone = findNode(ACT_1, args.zoneId)
		if (!zone || zone.kind !== "combat")
			throw new ConvexError(`Unknown combat zone: ${args.zoneId}`)

		// Wipe any leftover bag from a previous session (player closed tab mid-fight
		// last time, etc.). Combat scope is "what dropped in THIS visit only".
		if (char.currentZoneSession) {
			await deleteZoneBag(ctx, char.currentZoneSession)
		}

		const zoneSession = newZoneSession()
		await ctx.db.patch(args.characterId, { currentZoneSession: zoneSession })
		return { zoneSession }
	},
})

export const exitZone = mutation({
	args: {
		characterId: v.id("characters"),
		keepIds: v.array(v.id("items")),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacter(ctx, authUser._id, args.characterId)

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

		await ctx.db.patch(args.characterId, { currentZoneSession: undefined })
		return { kept: validKeeps.length, discarded: toDelete.length }
	},
})

/**
 * Move a subset of zone-bag items to inventory while keeping the session alive.
 * Validates ownership + inventory overflow.
 */
export const pickFromBag = mutation({
	args: {
		characterId: v.id("characters"),
		itemIds: v.array(v.id("items")),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacter(ctx, authUser._id, args.characterId)

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
 * Delete a subset of zone-bag items. Session stays alive.
 */
export const discardFromBag = mutation({
	args: {
		characterId: v.id("characters"),
		itemIds: v.array(v.id("items")),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacter(ctx, authUser._id, args.characterId)

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

// Derived from the single source of truth in src/game/stats/types so the
// validator and the EquippedSlot type can never drift.
const equippedSlotValidator = v.union(
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
		itemId: v.id("items"),
		targetSlot: equippedSlotValidator,
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacter(ctx, authUser._id, args.characterId)

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
		slot: equippedSlotValidator,
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		await loadOwnedCharacter(ctx, authUser._id, args.characterId)

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

		const { used, nextFreeSlot } = await fetchInventoryAllocator(
			ctx,
			args.characterId,
		)
		if (used + 1 > INVENTORY_MAX_SLOTS) {
			throw new ConvexError("Inventory full — free a slot first")
		}
		await ctx.db.patch(item._id, {
			locationKind: "inventory" as const,
			equippedSlot: undefined,
			inventorySlot: nextFreeSlot(),
		})
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
		itemId: v.id("items"),
		targetSlot: v.number(),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		await loadOwnedCharacter(ctx, authUser._id, args.characterId)

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
