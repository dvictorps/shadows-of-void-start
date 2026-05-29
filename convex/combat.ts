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
	ETHEREAL_INCENSE_DROP_CHANCE,
	MAX_POTIONS,
	POTION_DROP_CHANCE,
	teleportStoneTravelSeconds,
} from "../src/game/combat/constants"
import {
	classifyKill,
	resolveZoneProgress,
	tallyBossKill,
} from "../src/game/combat/kill"
import { resolvePotionUse } from "../src/game/combat/potion"
import { resolveVitalSync } from "../src/game/combat/vitals"
import {
	rollBossDrops,
	rollDrop,
	rollMinibossDrops,
} from "../src/game/loot/drops"
import { findBoss as findBossConfig } from "../src/game/bosses/data"
import type { BossId } from "../src/game/bosses/types"
import { findMonster } from "../src/game/monsters/data"
import { scaleMonsterStats } from "../src/game/monsters/scaling"
import {
	DEFAULT_ENCOUNTER_PLAN,
	rollCampThresholdsMs,
} from "../src/game/world/encounter-schedule"
import {
	applyDeathXpPenalty,
	applyXpGain,
} from "../src/game/progression/levels"
import { computeCharacterStats } from "../src/game/stats/compute"
import { ACT_1, findNode, isNodeAccessible } from "../src/game/world"
import { computeTravelTime } from "../src/game/world/travel"
import {
	appendUnique,
	clearCombatZoneState,
	deleteZoneBag,
	getCachedStats,
	loadEquippedSet,
	loadOrCreateCombatState,
	loadOrCreateProgression,
	loadOwnedCharacterWithSession,
	newZoneSession,
	refillPotionsToFloor,
} from "./_shared/character"
import type { Doc } from "./_generated/dataModel"
import { mutation } from "./_generated/server"
import { authComponent } from "./auth"

export const recordKill = mutation({
	args: {
		characterId: v.id("characters"),
		sessionToken: v.string(),
		monsterId: v.string(),
		// Server trusts the client-rolled level + rarity for now — see
		// docs/security/threat-model.md.
		monsterLevel: v.number(),
		monsterRarity: v.union(
			v.literal("normal"),
			v.literal("magic"),
			v.literal("rare"),
			v.literal("unique"),
		),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)
		const cs = await loadOrCreateCombatState(ctx, args.characterId, char)

		const monster = findMonster(args.monsterId)
		const boss = monster ? null : findBossConfig(args.monsterId as BossId)
		const template = monster ?? boss?.template
		if (!template) throw new ConvexError(`Unknown monster: ${args.monsterId}`)

		const monsterLevel = Math.max(1, Math.floor(args.monsterLevel))
		const scaled = scaleMonsterStats(template, monsterLevel)

		const xpAwarded = scaled.xpReward
		const { level, xp, levelsGained } = applyXpGain(
			char.level,
			cs.xp,
			xpAwarded,
		)

		const charUpdates: Record<string, unknown> = {}
		const csUpdates: Record<string, unknown> = {}

		if (level !== char.level) charUpdates.level = level
		csUpdates.xp = xp

		let magicFind: number
		let newMaxLife: number | undefined
		let newMaxBarrier: number | undefined
		if (levelsGained > 0 || char.cachedMaxLife === undefined) {
			if (levelsGained === 0) {
				// Defensive log — recordKill should never recompute stats outside
				// of a level-up. Reaching here means cachedMaxLife was undefined,
				// so an equip/unequip path forgot to refresh the cache.
				console.warn(
					`[recordKill] stat-cache miss for character ${args.characterId} — audit equip/unequip cache invalidation.`,
				)
			}
			const classDef = findClassDefinition(char.classId)
			const equippedItems = await loadEquippedSet(ctx, args.characterId)
			const stats = computeCharacterStats({
				classDef,
				level,
				equippedItems,
				selectedElement: char.selectedElement,
			})
			magicFind = stats.magicFind
			charUpdates.cachedMaxLife = stats.maxLife
			charUpdates.cachedMaxBarrier = stats.maxBarrier
			charUpdates.cachedMagicFind = stats.magicFind
			charUpdates.cachedMovementSpeed = stats.movementSpeed
			if (levelsGained > 0) {
				csUpdates.hpCurrent = stats.maxLife
				csUpdates.barrierCurrent = stats.maxBarrier
				newMaxLife = stats.maxLife
				newMaxBarrier = stats.maxBarrier
			}
		} else {
			magicFind = char.cachedMagicFind ?? 0
		}

		const currentLocation = char.currentLocation ?? "city"
		const zone = findNode(ACT_1, currentLocation)
		const { isBossKill, grantsCampTier, dropTable } = classifyKill(
			args.monsterRarity,
			zone?.kind,
		)

		const progress = resolveZoneProgress({
			grantsCampTier,
			zoneKind: zone?.kind,
			prevZoneKills: cs.currentZoneKills,
			prevInCamp: cs.inCamp,
		})
		csUpdates.currentZoneKills = progress.currentZoneKills
		if (progress.inCamp !== undefined) csUpdates.inCamp = progress.inCamp

		// Regular kills (the vast majority) never touch progression — skip the
		// index hit entirely. Miniboss / boss kills load it once and apply both
		// the completedZones append and the bossKillCounts bump against the
		// same doc.
		const progressionUpdates: Partial<Doc<"characterProgression">> = {}
		let progression: Doc<"characterProgression"> | undefined
		if (grantsCampTier) {
			progression = await loadOrCreateProgression(ctx, args.characterId, char)

			const nextCompleted = appendUnique(
				progression.completedZones,
				currentLocation,
			)
			if (nextCompleted !== progression.completedZones) {
				progressionUpdates.completedZones = nextCompleted
			}
			if (progress.resetCampSchedule && zone) {
				const plan = zone.encounterPlan ?? DEFAULT_ENCOUNTER_PLAN
				csUpdates.campThresholdsMs = rollCampThresholdsMs(plan)
				csUpdates.zoneStartedAt = Date.now()
				csUpdates.lastCampIndex = undefined
			}

			if (isBossKill) {
				// totalBossKills stays on characters — it's the leaderboard index
				// key. The legacy pre-backfill fallback lives in tallyBossKill.
				const tally = tallyBossKill(
					args.monsterId,
					(progression.bossKillCounts as
						| Record<string, number>
						| undefined) ?? {},
					char.totalBossKills,
				)
				progressionUpdates.bossKillCounts = tally.bossKillCounts
				charUpdates.totalBossKills = tally.totalBossKills
			}
		}

		const potionDropped =
			cs.potions < MAX_POTIONS && Math.random() < POTION_DROP_CHANCE
		if (potionDropped) {
			csUpdates.potions = cs.potions + 1
		}

		const incenseDropped = Math.random() < ETHEREAL_INCENSE_DROP_CHANCE
		if (incenseDropped) {
			csUpdates.etherealIncense = cs.etherealIncense + 1
		}

		await ctx.db.patch(cs._id, csUpdates)
		if (progression && Object.keys(progressionUpdates).length > 0) {
			await ctx.db.patch(progression._id, progressionUpdates)
		}
		if (Object.keys(charUpdates).length > 0) {
			await ctx.db.patch(args.characterId, charUpdates)
		}

		const zoneSession = cs.currentZoneSession
		if (zoneSession) {
			const mf = magicFind
			const rolledDrops =
				dropTable === "boss"
					? rollBossDrops({ monsterLevel, magicFind: mf })
					: dropTable === "miniboss"
						? rollMinibossDrops({ monsterLevel, magicFind: mf })
						: [
								rollDrop({
									monsterRarity: args.monsterRarity,
									monsterLevel,
									magicFind: mf,
								}),
							].filter((d): d is NonNullable<typeof d> => d !== null)
			for (const drop of rolledDrops) {
				await ctx.db.insert("items", {
					authUserId: authUser._id,
					locationKind: "zoneBag",
					characterId: args.characterId,
					zoneSession,
					data: drop,
					droppedAt: Date.now(),
					droppedFrom: template.id,
					droppedFromLevel: monsterLevel,
				})
			}
		}

		// Drops aren't returned — the `items.zoneBag` query is already
		// subscribed during combat and picks them up reactively.
		return {
			xpGained: xpAwarded,
			levelsGained,
			potionDropped,
			incenseDropped,
			newMaxLife,
			newMaxBarrier,
		}
	},
})

export const usePotion = mutation({
	args: {
		characterId: v.id("characters"),
		sessionToken: v.string(),
		clientHp: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)
		const cs = await loadOrCreateCombatState(ctx, args.characterId, char)

		const { maxLife } = await getCachedStats(ctx, args.characterId, char)
		const result = resolvePotionUse({
			potions: cs.potions,
			maxLife,
			prevHp: cs.hpCurrent,
			clientHp: args.clientHp,
		})
		if (!result.ok) {
			throw new ConvexError(
				result.reason === "no-potions"
					? "No potions to use"
					: "Already at full HP",
			)
		}

		await ctx.db.patch(cs._id, {
			hpCurrent: result.hpCurrent,
			potions: result.potions,
		})
		return { hpCurrent: result.hpCurrent, potions: result.potions }
	},
})

// Decrement the carried Incenso Etéreo counter. The cinematic is purely
// client-side — the server only owns the counter. Per CONTEXT.md → Incenso
// Etéreo, the gameplay gates (no boss, no overlapping camp) are enforced on
// the client (no shared state to validate against here). Client-event trust
// model documented in docs/security/threat-model.md.
export const useEtherealIncense = mutation({
	args: { characterId: v.id("characters"), sessionToken: v.string() },
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)
		const cs = await loadOrCreateCombatState(ctx, args.characterId, char)

		if (cs.etherealIncense <= 0) throw new ConvexError("No incense to use")

		const currentLocation = char.currentLocation ?? "city"
		const zone = findNode(ACT_1, currentLocation)
		if (zone?.kind === "boss") {
			throw new ConvexError("Cannot use incense inside a boss node")
		}

		await ctx.db.patch(cs._id, {
			etherealIncense: cs.etherealIncense - 1,
		})
		return { etherealIncense: cs.etherealIncense - 1 }
	},
})

// Camp entry triggered by Incenso Etéreo. Bypasses the time-threshold gate
// since incense is a player-driven "summon a camp" affordance — the gate
// is the consumed counter (charged in useEtherealIncense). Sets inCamp =
// true. Idempotent. Distinct from `enterCamp` so the time-gated path can't
// be widened by accident. See docs/plans/in-progress.md
// "Server-authoritative camp/phase derivation".
export const enterCampViaIncense = mutation({
	args: { characterId: v.id("characters"), sessionToken: v.string() },
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)
		const cs = await loadOrCreateCombatState(ctx, args.characterId, char)

		if (cs.zoneStartedAt === undefined)
			throw new ConvexError("Not in a zone")

		await ctx.db.patch(cs._id, { inCamp: true })
		return { inCamp: true }
	},
})

export const syncHp = mutation({
	args: {
		characterId: v.id("characters"),
		sessionToken: v.string(),
		hpCurrent: v.number(),
		barrierCurrent: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)
		const cs = await loadOrCreateCombatState(ctx, args.characterId, char)

		const { maxLife, maxBarrier } = await getCachedStats(ctx, args.characterId, char)
		const { hpCurrent, patch } = resolveVitalSync({
			maxLife,
			maxBarrier,
			prevHp: cs.hpCurrent,
			prevBarrier: cs.barrierCurrent,
			clientHp: args.hpCurrent,
			clientBarrier: args.barrierCurrent,
		})

		if (Object.keys(patch).length === 0) return { hpCurrent }

		await ctx.db.patch(cs._id, patch)
		return { hpCurrent }
	},
})

export const enterCity = mutation({
	args: { characterId: v.id("characters"), sessionToken: v.string() },
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)
		const cs = await loadOrCreateCombatState(ctx, args.characterId, char)

		const { maxLife, maxBarrier } = await getCachedStats(ctx, args.characterId, char)
		const refilledPotions = refillPotionsToFloor(cs)

		await ctx.db.patch(cs._id, {
			hpCurrent: maxLife,
			potions: refilledPotions,
			barrierCurrent: maxBarrier,
		})
		return { hpCurrent: maxLife, potions: refilledPotions }
	},
})

export const respawnDead = mutation({
	args: { characterId: v.id("characters"), sessionToken: v.string() },
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)
		const cs = await loadOrCreateCombatState(ctx, args.characterId, char)

		if (cs.currentZoneSession) {
			await deleteZoneBag(ctx, cs.currentZoneSession)
		}

		if (char.hardcore) {
			const ownedItems = await ctx.db
				.query("items")
				.withIndex("by_character_kind", (q) =>
					q.eq("characterId", args.characterId),
				)
				.collect()
			await Promise.all(ownedItems.map((item) => ctx.db.delete(item._id)))
			await ctx.db.delete(cs._id)
			await ctx.db.patch(args.characterId, {
				dead: true,
				currentLocation: undefined,
				travelDestination: undefined,
				travelStartedAt: undefined,
				travelArrivesAt: undefined,
				activeSessionToken: undefined,
			})
			return { mode: "hardcore" as const, xpLost: 0 }
		}

		const { xp, xpLost } = applyDeathXpPenalty(cs.xp)
		const { maxLife, maxBarrier } = await getCachedStats(ctx, args.characterId, char)
		const refilledPotions = refillPotionsToFloor(cs)

		await ctx.db.patch(cs._id, {
			hpCurrent: maxLife,
			barrierCurrent: maxBarrier,
			xp,
			potions: refilledPotions,
			...clearCombatZoneState(),
			currentZoneKills: 0,
		})
		await ctx.db.patch(args.characterId, {
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
		sessionToken: v.string(),
		zoneId: v.string(),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)
		const cs = await loadOrCreateCombatState(ctx, args.characterId, char)

		const zone = findNode(ACT_1, args.zoneId)
		if (!zone || (zone.kind !== "combat" && zone.kind !== "boss"))
			throw new ConvexError(`Unknown combat zone: ${args.zoneId}`)

		const currentLocation = char.currentLocation ?? "city"
		if (char.travelDestination !== undefined)
			throw new ConvexError("Cannot enter — travel in progress")
		if (currentLocation !== args.zoneId)
			throw new ConvexError(
				`Cannot enter ${args.zoneId} from ${currentLocation}`,
			)

		if (cs.currentZoneSession) {
			await deleteZoneBag(ctx, cs.currentZoneSession)
		}

		const { maxLife, maxBarrier } = await getCachedStats(ctx, args.characterId, char)

		const zoneSession = newZoneSession()
		const encounterPlan = zone.encounterPlan ?? DEFAULT_ENCOUNTER_PLAN
		const campThresholdsMs =
			zone.kind === "boss" ? [] : rollCampThresholdsMs(encounterPlan)
		const zoneStartedAt = Date.now()

		await ctx.db.patch(cs._id, {
			...clearCombatZoneState(),
			hpCurrent: maxLife,
			barrierCurrent: maxBarrier,
			currentZoneSession: zoneSession,
			currentZoneKills: 0,
			zoneStartedAt,
			campThresholdsMs,
		})
		return { zoneSession, zoneStartedAt, campThresholdsMs }
	},
})

// Camp entry — gated server-side by the elapsed-time threshold rolled at
// enterZone. Closes Threat #3 (client-trusted phase). The 500ms grace window
// absorbs clock drift between the client's calmaria ticker and the server's
// wall clock so a legitimate camp trigger isn't rejected for being a frame
// too early. See docs/plans/in-progress.md "Server-authoritative camp/phase
// derivation".
const ENTER_CAMP_GRACE_MS = 500

export const enterCamp = mutation({
	args: {
		characterId: v.id("characters"),
		sessionToken: v.string(),
		thresholdIndex: v.number(),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)
		const cs = await loadOrCreateCombatState(ctx, args.characterId, char)

		if (cs.zoneStartedAt === undefined) throw new ConvexError("Not in a zone")

		const currentLocation = char.currentLocation ?? "city"
		const zone = findNode(ACT_1, currentLocation)
		if (zone?.kind === "boss") throw new ConvexError("No camps in boss nodes")

		const thresholds = cs.campThresholdsMs ?? []
		if (
			args.thresholdIndex < 0 ||
			args.thresholdIndex >= thresholds.length
		)
			throw new ConvexError("Invalid camp threshold")

		if (cs.inCamp) return { inCamp: true }

		if (
			cs.lastCampIndex !== undefined &&
			args.thresholdIndex <= cs.lastCampIndex
		) {
			throw new ConvexError("Camp threshold already consumed")
		}

		const threshold = thresholds[args.thresholdIndex]
		const elapsed = Date.now() - cs.zoneStartedAt
		if (elapsed < threshold - ENTER_CAMP_GRACE_MS) {
			throw new ConvexError("Camp threshold not reached")
		}

		await ctx.db.patch(cs._id, {
			inCamp: true,
			lastCampIndex: args.thresholdIndex,
		})
		return { inCamp: true }
	},
})

// Camp exit — clears the inCamp flag. Called when the player picks "Seguir
// em frente" on the camp panel. No time gate; the cinematic is purely a
// player-driven dismiss.
export const exitCamp = mutation({
	args: { characterId: v.id("characters"), sessionToken: v.string() },
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)
		const cs = await loadOrCreateCombatState(ctx, args.characterId, char)

		await ctx.db.patch(cs._id, { inCamp: false })
		return { inCamp: false }
	},
})

export const startTravel = mutation({
	args: {
		characterId: v.id("characters"),
		sessionToken: v.string(),
		destinationNodeId: v.string(),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)

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

		const progression = await loadOrCreateProgression(
			ctx,
			args.characterId,
			char,
		)
		if (!isNodeAccessible(destNode, progression.completedZones))
			throw new ConvexError("zone-locked")

		const { movementSpeed } = await getCachedStats(ctx, args.characterId, char)
		const seconds = computeTravelTime(connection.distance, movementSpeed)
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
	args: { characterId: v.id("characters"), sessionToken: v.string() },
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)

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
		const progression = await loadOrCreateProgression(
			ctx,
			args.characterId,
			char,
		)
		const nextUnlocked = appendUnique(
			progression.unlockedNodes,
			char.travelDestination,
		)

		await ctx.db.patch(args.characterId, {
			currentLocation: char.travelDestination,
			travelDestination: undefined,
			travelStartedAt: undefined,
			travelArrivesAt: undefined,
		})
		if (nextUnlocked !== progression.unlockedNodes) {
			await ctx.db.patch(progression._id, { unlockedNodes: nextUnlocked })
		}
		return { arrivedAt: char.travelDestination }
	},
})

// Teleport stone — single travel consumable for skipping geography. Takes
// the player to any previously-visited node (`unlockedNodes`). The wind
// crystal was consolidated into this; `windCrystals` schema field stays
// for legacy data only. City arrival heals + refills potion (the original
// "safety hub" contract); other nodes just transport. Wipes the zone bag
// on use — bag-retention tiers land in a later PR.
export const useTeleportStone = mutation({
	args: {
		characterId: v.id("characters"),
		sessionToken: v.string(),
		destinationNodeId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)
		const cs = await loadOrCreateCombatState(ctx, args.characterId, char)

		const stones = char.teleportStones ?? 0
		if (stones <= 0) throw new ConvexError("No teleport stones")

		const destinationNodeId = args.destinationNodeId ?? "city"

		if (destinationNodeId !== "city") {
			if (char.travelDestination !== undefined)
				throw new ConvexError("Already traveling")
			const fromId = char.currentLocation ?? "city"
			if (fromId === destinationNodeId)
				throw new ConvexError("Already at destination")

			const progression = await loadOrCreateProgression(
				ctx,
				args.characterId,
				char,
			)
			if (!progression.unlockedNodes.includes(destinationNodeId))
				throw new ConvexError("Destination not yet unlocked")

			const destNode = findNode(ACT_1, destinationNodeId)
			if (!destNode)
				throw new ConvexError(`Unknown destination: ${destinationNodeId}`)

			if (!isNodeAccessible(destNode, progression.completedZones))
				throw new ConvexError("zone-locked")
		}

		if (cs.currentZoneSession) {
			await deleteZoneBag(ctx, cs.currentZoneSession)
		}
		const startedAt = Date.now()
		const arrivesAt =
			startedAt + teleportStoneTravelSeconds(destinationNodeId) * 1000

		if (destinationNodeId === "city") {
			const { maxLife, maxBarrier } = await getCachedStats(ctx, args.characterId, char)
			const refilledPotions = refillPotionsToFloor(cs)

			await ctx.db.patch(cs._id, {
				hpCurrent: maxLife,
				barrierCurrent: maxBarrier,
				potions: refilledPotions,
				...clearCombatZoneState(),
			})
			await ctx.db.patch(args.characterId, {
				teleportStones: stones - 1,
				travelDestination: "city",
				travelStartedAt: startedAt,
				travelArrivesAt: arrivesAt,
			})
			return { teleportStones: stones - 1, startedAt, arrivesAt }
		}

		await ctx.db.patch(cs._id, clearCombatZoneState())
		await ctx.db.patch(args.characterId, {
			teleportStones: stones - 1,
			travelDestination: destinationNodeId,
			travelStartedAt: startedAt,
			travelArrivesAt: arrivesAt,
		})
		return { teleportStones: stones - 1, startedAt, arrivesAt }
	},
})

const ELEMENT_SWITCH_COOLDOWN_MS = 5_000

export const switchElement = mutation({
	args: {
		characterId: v.id("characters"),
		sessionToken: v.string(),
		element: v.union(
			v.literal("fire"),
			v.literal("cold"),
			v.literal("lightning"),
		),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)

		if (char.classId !== "mage")
			throw new ConvexError("Only mages can switch elements")

		if (args.element === char.selectedElement) return

		const now = Date.now()
		if (
			char.lastElementSwitchAt &&
			now - char.lastElementSwitchAt < ELEMENT_SWITCH_COOLDOWN_MS
		) {
			throw new ConvexError("Element switch on cooldown")
		}

		await ctx.db.patch(args.characterId, {
			selectedElement: args.element,
			lastElementSwitchAt: now,
		})
	},
})
