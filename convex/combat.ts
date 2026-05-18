import { ConvexError, v } from "convex/values"
import { findClassDefinition } from "../src/game/classes/data"
import { POTION_HEAL_FRACTION } from "../src/game/combat/constants"
import { rollDrop, rollMonsterLevel } from "../src/game/loot/drops"
import { findMonster } from "../src/game/monsters/data"
import {
	applyDeathXpPenalty,
	applyXpGain,
} from "../src/game/progression/levels"
import { computeCharacterStats } from "../src/game/stats/compute"
import { ACT_1, findNode } from "../src/game/world"
import {
	deleteZoneBag,
	loadEquippedSet,
	loadOwnedCharacter,
	newZoneSession,
} from "./_shared/character"
import type { Doc, Id } from "./_generated/dataModel"
import { mutation } from "./_generated/server"
import { authComponent } from "./auth"

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
