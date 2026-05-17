import { ConvexError, v } from "convex/values"
import {
	CLASS_DEFINITIONS,
	findClassDefinition,
} from "../src/game/classes/data"
import type { CharacterClassId } from "../src/game/classes/types"
import { STARTER_WEAPON_BY_CLASS } from "../src/game/items/starter-gear"
import { findMonster } from "../src/game/monsters/data"
import {
	applyDeathXpPenalty,
	applyXpGain,
	computeMaxHp,
} from "../src/game/progression/levels"
import type { Doc, Id } from "./_generated/dataModel"
import { mutation, type MutationCtx, query } from "./_generated/server"
import { authComponent } from "./auth"

const MAX_CHARACTERS_PER_USER = 8
const MAX_NAME_LENGTH = 20
const STARTING_POTIONS = 5
const POTION_HEAL_FRACTION = 0.2

function isKnownClassId(id: string): id is CharacterClassId {
	return Object.hasOwn(CLASS_DEFINITIONS, id)
}

function defaultStarterWeapon(classId: string): string | undefined {
	return isKnownClassId(classId) ? STARTER_WEAPON_BY_CLASS[classId] : undefined
}

function normalize(char: Doc<"characters">) {
	const classDef = findClassDefinition(char.classId)
	const maxHp = computeMaxHp(classDef, char.level)
	return {
		xp: char.xp ?? 0,
		hpCurrent: char.hpCurrent ?? maxHp,
		maxHp,
		potions: char.potions ?? 0,
		hardcore: char.hardcore ?? false,
		equippedWeapon: char.equippedWeapon ?? defaultStarterWeapon(char.classId),
	}
}

/**
 * Returns all characters owned by the current user, newest first.
 * Returns an empty array if unauthenticated.
 */
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

/**
 * Creates a character for the current user.
 */
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
			throw new ConvexError(`Name must be at most ${MAX_NAME_LENGTH} characters`)

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
		const maxHp = computeMaxHp(classDef, 1)
		const starterWeapon = defaultStarterWeapon(args.classId)

		return await ctx.db.insert("characters", {
			authUserId: authUser._id,
			name,
			classId: args.classId,
			level: 1,
			xp: 0,
			hpCurrent: maxHp,
			potions: STARTING_POTIONS,
			hardcore: args.hardcore ?? false,
			equippedWeapon: starterWeapon,
			createdAt: Date.now(),
		})
	},
})

/**
 * Deletes a character owned by the current user.
 */
export const remove = mutation({
	args: { id: v.id("characters") },
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")

		const char = await ctx.db.get(args.id)
		if (!char) throw new ConvexError("Character not found")
		if (char.authUserId !== authUser._id)
			throw new ConvexError("Not your character")

		await ctx.db.delete(args.id)
	},
})

// ── Combat mutations ──

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

/**
 * Records a monster kill, granting XP server-side. The client tells us *which*
 * monster was killed; the server looks up its XP reward — clients never pick
 * the amount themselves.
 */
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

		const updates: Partial<Doc<"characters">> = {
			level,
			xp,
		}

		// On level-up, refill HP to the new max as a quality-of-life beat.
		if (levelsGained > 0) {
			const classDef = findClassDefinition(char.classId)
			updates.hpCurrent = computeMaxHp(classDef, level)
		}

		await ctx.db.patch(args.characterId, updates)
		return { xpGained: monster.xpReward, levelsGained }
	},
})

/**
 * Consumes one potion and heals the character. Validated server-side.
 */
export const usePotion = mutation({
	args: { characterId: v.id("characters") },
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacter(ctx, authUser._id, args.characterId)

		const potions = char.potions ?? 0
		if (potions <= 0) throw new ConvexError("No potions to use")

		const classDef = findClassDefinition(char.classId)
		const maxHp = computeMaxHp(classDef, char.level)
		const currentHp = char.hpCurrent ?? maxHp
		if (currentHp >= maxHp) throw new ConvexError("Already at full HP")

		const healed = Math.min(maxHp, currentHp + Math.floor(maxHp * POTION_HEAL_FRACTION))
		await ctx.db.patch(args.characterId, {
			hpCurrent: healed,
			potions: potions - 1,
		})
		return { hpCurrent: healed, potions: potions - 1 }
	},
})

/**
 * Periodic HP sync from the client. The server clamps to [0, maxHp] and
 * accepts whatever value the client claims within that range. This is the
 * "trust with sanity check" path; authoritative events still go through
 * recordKill / usePotion / respawn.
 */
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
		const maxHp = computeMaxHp(classDef, char.level)
		const clamped = Math.max(0, Math.min(maxHp, Math.floor(args.hpCurrent)))

		await ctx.db.patch(args.characterId, { hpCurrent: clamped })
		return { hpCurrent: clamped }
	},
})

/**
 * Entering a city node: full heal, plus a courtesy refill to 1 potion if the
 * character has zero. Prevents being stranded with no recovery options.
 */
export const enterCity = mutation({
	args: { characterId: v.id("characters") },
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacter(ctx, authUser._id, args.characterId)

		const classDef = findClassDefinition(char.classId)
		const maxHp = computeMaxHp(classDef, char.level)
		const potions = char.potions ?? 0
		const refilledPotions = potions === 0 ? 1 : potions

		await ctx.db.patch(args.characterId, {
			hpCurrent: maxHp,
			potions: refilledPotions,
		})
		return { hpCurrent: maxHp, potions: refilledPotions }
	},
})

/**
 * Death handler. Softcore: apply XP penalty, full heal, character persists.
 * Hardcore: delete the character permanently.
 */
export const respawnDead = mutation({
	args: { characterId: v.id("characters") },
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacter(ctx, authUser._id, args.characterId)

		if (char.hardcore) {
			await ctx.db.delete(args.characterId)
			return { mode: "hardcore" as const, xpLost: 0 }
		}

		const { xp, xpLost } = applyDeathXpPenalty(char.xp ?? 0)
		const classDef = findClassDefinition(char.classId)
		const maxHp = computeMaxHp(classDef, char.level)

		await ctx.db.patch(args.characterId, {
			hpCurrent: maxHp,
			xp,
		})
		return { mode: "softcore" as const, xpLost }
	},
})

/**
 * Convenience query so the world view can subscribe to a single character.
 */
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
