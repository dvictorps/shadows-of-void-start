// ─────────────────────────────────────────────────────────────────────────────
//  Combat + zone-session mutations. All client-mutable combat state (HP, XP,
//  zone session, travel) lives here. Drop rolling and XP scaling are
//  server-authoritative; per-tick combat sim runs on the client.
//
//  Mutations in this file:
//    recordKill            ← XP + drop + potion roll on monster kill
//    usePotion             ← heal 20% of max HP, decrement count
//    syncHp                ← periodic HP write-back from the combat loop
//    enterCity             ← full heal + potion refill
//    respawnDead           ← softcore: XP penalty + reset to city; hardcore: delete
//    enterZone             ← issue a new zoneSession, wipe any prior bag
//    startTravel           ← begin time-gated node transition
//    arriveAtTravel        ← commit arrival + append to unlockedNodes
//    useTeleportStone      ← travel to any unlocked node (city: short hop + heal/refill;
//                            others: standard skip-zones travel). Wipes the zone bag if
//                            used mid-zone. Consolidates the retired useWindCrystal.
//
//  Trust model: client-driven event triggers (recordKill, syncHp). Layered
//  hardening is deferred — see docs/security/threat-model.md.
// ─────────────────────────────────────────────────────────────────────────────

import { ConvexError, v } from "convex/values"
import { findClassDefinition } from "../src/game/classes/data"
import {
	MAX_POTIONS,
	POTION_DROP_CHANCE,
	POTION_HEAL_FRACTION,
} from "../src/game/combat/constants"
import { rollDrop, rollMinibossDrops } from "../src/game/loot/drops"
import { findMonster } from "../src/game/monsters/data"
import { scaleMonsterStats } from "../src/game/monsters/scaling"
import {
	applyDeathXpPenalty,
	applyXpGain,
} from "../src/game/progression/levels"
import { computeCharacterStats } from "../src/game/stats/compute"
import {
	TELEPORT_STONE_TRAVEL_SECONDS_CITY,
	TELEPORT_STONE_TRAVEL_SECONDS_NON_CITY,
} from "../src/game/combat/constants"
import { ACT_1, findNode, isNodeAccessible } from "../src/game/world"
import { computeTravelTime } from "../src/game/world/travel"
import {
	appendUnique,
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
		// Server trusts the client-rolled level + rarity for now — see
		// docs/security/threat-model.md.
		monsterLevel: v.number(),
		monsterRarity: v.union(
			v.literal("normal"),
			v.literal("magic"),
			v.literal("rare"),
		),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacter(ctx, authUser._id, args.characterId)

		const monster = findMonster(args.monsterId)
		if (!monster) throw new ConvexError(`Unknown monster: ${args.monsterId}`)

		const monsterLevel = Math.max(1, Math.floor(args.monsterLevel))
		const scaled = scaleMonsterStats(monster, monsterLevel)

		const { level, xp, levelsGained } = applyXpGain(
			char.level,
			char.xp ?? 0,
			scaled.xpReward,
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

		// See CONTEXT.md → Threshold Bar and Zone states.
		const isMinibossKill = args.monsterRarity === "rare"
		const currentZoneKills = char.currentZoneKills ?? 0
		const currentLocation = char.currentLocation ?? "city"
		if (isMinibossKill) {
			updates.currentZoneKills = 0
			const completed = char.completedZones ?? []
			if (!completed.includes(currentLocation)) {
				updates.completedZones = [...completed, currentLocation]
			}
		} else {
			updates.currentZoneKills = currentZoneKills + 1
		}

		// Potion drop — independent of the equipment roll. At the 10-potion cap
		// the roll is wasted silently (per CONTEXT.md → Potion drops).
		const currentPotions = char.potions ?? 0
		const potionDropped =
			currentPotions < MAX_POTIONS && Math.random() < POTION_DROP_CHANCE
		if (potionDropped) {
			updates.potions = currentPotions + 1
		}

		await ctx.db.patch(args.characterId, updates)

		// Rare minibosses: 2 items with 1 guaranteed Rare per CONTEXT.md →
		// Loot Pipeline → Drop rates. Other rarities use the standard table.
		const zoneSession = char.currentZoneSession
		const drops: Array<{ id: Id<"items">; data: Doc<"items">["data"] }> = []
		if (zoneSession) {
			const rolledDrops = isMinibossKill
				? rollMinibossDrops({ monsterLevel })
				: [
						rollDrop({
							monsterRarity: args.monsterRarity,
							monsterLevel,
						}),
					].filter((d): d is NonNullable<typeof d> => d !== null)
			for (const drop of rolledDrops) {
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

		return { xpGained: scaled.xpReward, levelsGained, drops, potionDropped }
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
			currentZoneKills: 0,
			// Respawn resets you to the city and clears any in-flight travel.
			currentLocation: "city",
			travelDestination: undefined,
			travelStartedAt: undefined,
			travelArrivesAt: undefined,
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

		// Travel guard — the character must be at this zone (already arrived) and
		// not actively in transit.
		const currentLocation = char.currentLocation ?? "city"
		if (char.travelDestination !== undefined)
			throw new ConvexError("Cannot enter — travel in progress")
		if (currentLocation !== args.zoneId)
			throw new ConvexError(
				`Cannot enter ${args.zoneId} from ${currentLocation}`,
			)

		// Wipe any leftover bag from a previous session (player closed tab mid-fight
		// last time, etc.). Combat scope is "what dropped in THIS visit only".
		if (char.currentZoneSession) {
			await deleteZoneBag(ctx, char.currentZoneSession)
		}

		const zoneSession = newZoneSession()
		// Threshold counter resets on every entry — per CONTEXT.md: "fill resets
		// to 0 every time the player leaves the zone with the miniboss unsummoned".
		// Boss Deferral isn't implemented yet, so the counter resets unconditionally.
		await ctx.db.patch(args.characterId, {
			currentZoneSession: zoneSession,
			currentZoneKills: 0,
		})
		return { zoneSession }
	},
})

export const startTravel = mutation({
	args: {
		characterId: v.id("characters"),
		destinationNodeId: v.string(),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacter(ctx, authUser._id, args.characterId)

		if (char.travelDestination !== undefined)
			throw new ConvexError("Already traveling")

		const fromId = char.currentLocation ?? "city"
		if (fromId === args.destinationNodeId)
			throw new ConvexError("Already at destination")

		const fromNode = findNode(ACT_1, fromId)
		if (!fromNode) throw new ConvexError(`Unknown current location: ${fromId}`)

		const connection = fromNode.connections.find(
			(c) => c.id === args.destinationNodeId,
		)
		if (!connection)
			throw new ConvexError(
				`No route from ${fromId} to ${args.destinationNodeId}`,
			)

		const destNode = findNode(ACT_1, args.destinationNodeId)
		if (!destNode)
			throw new ConvexError(
				`Unknown destination node: ${args.destinationNodeId}`,
			)

		if (!isNodeAccessible(destNode, char.completedZones))
			throw new ConvexError("zone-locked")

		const classDef = findClassDefinition(char.classId)
		const equippedItems = await loadEquippedSet(ctx, args.characterId)
		const stats = computeCharacterStats({
			classDef,
			level: char.level,
			equippedItems,
		})
		const seconds = computeTravelTime(connection.distance, stats.movementSpeed)
		const startedAt = Date.now()
		const arrivesAt = startedAt + Math.round(seconds * 1000)

		await ctx.db.patch(args.characterId, {
			travelDestination: args.destinationNodeId,
			travelStartedAt: startedAt,
			travelArrivesAt: arrivesAt,
		})
		return { startedAt, arrivesAt, durationMs: arrivesAt - startedAt }
	},
})

// Tolerance for client/server clock skew on travel arrival. The client
// schedules `arriveAtTravel` based on its own `Date.now()`; the server
// validates against its own. A small grace window prevents legitimate
// arrivals from being rejected just because the server clock trails the
// client by a few ms. Negligible exploit surface: travel is a UX delay,
// not a gating mechanism.
const TRAVEL_ARRIVAL_GRACE_MS = 1000

export const arriveAtTravel = mutation({
	args: { characterId: v.id("characters") },
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacter(ctx, authUser._id, args.characterId)

		// Idempotent: if there's no active travel, the caller is either retrying
		// a successful arrival or hitting a stale timer. Either way, succeed
		// silently with the current location — surfacing an error here makes
		// the client log noise without helping the user.
		if (!char.travelDestination || !char.travelArrivesAt) {
			return { arrivedAt: char.currentLocation ?? "city" }
		}
		if (Date.now() < char.travelArrivesAt - TRAVEL_ARRIVAL_GRACE_MS) {
			throw new ConvexError("Travel not complete")
		}

		// Append destination to the unlocked set on first arrival. Wind crystals
		// later read this list to validate jump targets.
		const unlocked = char.unlockedNodes ?? ["city"]
		const nextUnlocked = appendUnique(unlocked, char.travelDestination)

		await ctx.db.patch(args.characterId, {
			currentLocation: char.travelDestination,
			travelDestination: undefined,
			travelStartedAt: undefined,
			travelArrivesAt: undefined,
			unlockedNodes: nextUnlocked,
		})
		return { arrivedAt: char.travelDestination }
	},
})

// Teleport stone — single travel consumable for skipping geography. Takes
// the player to any previously-visited node (`unlockedNodes`). The wind
// crystal was consolidated into this in feat/stone-consolidation; the
// `windCrystals` schema field stays for legacy data but no longer drives
// any mutation.
//
// Two branches:
//   - destinationNodeId omitted / "city" — short hop home with heal +
//     potion refill on arrival. Same contract as the legacy "panic
//     button" return.
//   - destinationNodeId is a non-city unlocked node — set travel state
//     (arrival cascades through the existing arriveAtTravel flow). No
//     heal/refill; this is a transport, not a respite.
//
// In both cases the active zone bag is wiped if present — using the stone
// from inside a zone is still a panic exit. The bag-retention tier work
// (camp / exploration / combat caps) lands in a later PR; until then the
// stone keeps its existing wipe behavior.
export const useTeleportStone = mutation({
	args: {
		characterId: v.id("characters"),
		// Optional for backward-compat with call sites that haven't been
		// updated yet — undefined is interpreted as `"city"`.
		destinationNodeId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacter(ctx, authUser._id, args.characterId)

		const stones = char.teleportStones ?? 0
		if (stones <= 0) throw new ConvexError("No teleport stones")

		const destinationNodeId = args.destinationNodeId ?? "city"
		const fromId = char.currentLocation ?? "city"

		// Destination validation runs for non-city targets only. "city" is
		// always available (seeded into `unlockedNodes` on character creation,
		// no zone-gate upstream).
		if (destinationNodeId !== "city") {
			if (char.travelDestination !== undefined)
				throw new ConvexError("Already traveling")
			if (fromId === destinationNodeId)
				throw new ConvexError("Already at destination")

			const destNode = findNode(ACT_1, destinationNodeId)
			if (!destNode)
				throw new ConvexError(`Unknown destination: ${destinationNodeId}`)

			const unlocked = char.unlockedNodes ?? ["city"]
			if (!unlocked.includes(destinationNodeId))
				throw new ConvexError("Destination not yet unlocked")

			if (!isNodeAccessible(destNode, char.completedZones))
				throw new ConvexError("zone-locked")
		}

		if (char.currentZoneSession) {
			await deleteZoneBag(ctx, char.currentZoneSession)
		}

		// City arrival is the original "safety hub" contract: heal + refill
		// potion to at least 1, instant arrival (no travel state). Non-city
		// arrivals route through the standard travel flow so the progress bar
		// works and `arriveAtTravel` commits the location change.
		if (destinationNodeId === "city") {
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

			const startedAt = Date.now()
			const arrivesAt =
				startedAt + TELEPORT_STONE_TRAVEL_SECONDS_CITY * 1000

			await ctx.db.patch(args.characterId, {
				teleportStones: stones - 1,
				hpCurrent: maxHp,
				potions: refilledPotions,
				currentZoneSession: undefined,
				travelDestination: "city",
				travelStartedAt: startedAt,
				travelArrivesAt: arrivesAt,
			})
			return { teleportStones: stones - 1, startedAt, arrivesAt }
		}

		const startedAt = Date.now()
		const arrivesAt =
			startedAt + TELEPORT_STONE_TRAVEL_SECONDS_NON_CITY * 1000

		await ctx.db.patch(args.characterId, {
			teleportStones: stones - 1,
			currentZoneSession: undefined,
			travelDestination: destinationNodeId,
			travelStartedAt: startedAt,
			travelArrivesAt: arrivesAt,
		})
		return { teleportStones: stones - 1, startedAt, arrivesAt }
	},
})
