import { ConvexError, v } from "convex/values"
import {
	CLASS_DEFINITIONS,
	findClassDefinition,
} from "../src/game/classes/data"
import type { CharacterClassId } from "../src/game/classes/types"
import { findStarterItem, STARTER_WEAPON_BY_CLASS } from "../src/game/items/starter-gear"
import { computeCharacterStats } from "../src/game/stats/compute"
import type { Doc } from "./_generated/dataModel"
import { mutation, query } from "./_generated/server"
import { authComponent } from "./auth"

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
		// Travel system defaults: new characters start in the city, not traveling.
		currentLocation: char.currentLocation ?? "city",
		travelDestination: char.travelDestination,
		travelArrivesAt: char.travelArrivesAt,
	}
}

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
			currentLocation: "city",
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
