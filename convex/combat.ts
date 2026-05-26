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
	POTION_HEAL_FRACTION,
	teleportStoneTravelSeconds,
} from "../src/game/combat/constants"
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
	applyOverlevelPenalty,
	applyXpGain,
} from "../src/game/progression/levels"
import { computeCharacterStats } from "../src/game/stats/compute"
import { ACT_1, findNode, isNodeAccessible } from "../src/game/world"
import { computeTravelTime } from "../src/game/world/travel"
import {
	appendUnique,
	clearPerVisitZoneState,
	deleteZoneBag,
	loadEquippedSet,
	loadOwnedCharacterWithSession,
	newZoneSession,
	refillPotionsToFloor,
} from "./_shared/character"
import type { Doc, Id } from "./_generated/dataModel"
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

		// Bosses live in the BOSSES registry (src/game/bosses/), not MONSTERS.
		// Fall back to findBoss when findMonster misses.
		const monster = findMonster(args.monsterId)
		const boss = monster ? null : findBossConfig(args.monsterId as BossId)
		const template = monster ?? boss?.template
		if (!template) throw new ConvexError(`Unknown monster: ${args.monsterId}`)

		const monsterLevel = Math.max(1, Math.floor(args.monsterLevel))
		const scaled = scaleMonsterStats(template, monsterLevel)

		// Over-leveling penalty: characters more than +2 levels above the
		// monster lose XP quadratically (see applyOverlevelPenalty).
		const xpAwarded = applyOverlevelPenalty(
			scaled.xpReward,
			char.level,
			monsterLevel,
		)
		const { level, xp, levelsGained } = applyXpGain(
			char.level,
			char.xp ?? 0,
			xpAwarded,
		)

		const updates: Partial<Doc<"characters">> = { level, xp }

		if (levelsGained > 0) {
			const classDef = findClassDefinition(char.classId)
			const equippedItems = await loadEquippedSet(ctx, args.characterId)
			const stats = computeCharacterStats({
				classDef,
				level,
				equippedItems,
				selectedElement: char.selectedElement,
			})
			updates.hpCurrent = stats.maxLife
		}

		// See CONTEXT.md → Threshold Bar and Zone states. Three kill flows:
		//   - zone miniboss (rare in `kind: "combat"`): completes zone, inCamp
		//   - act boss (unique): completes node like a miniboss, inCamp
		//   - gauntlet rare (rare in `kind: "boss"`): just a combat kill
		const currentZoneKills = char.currentZoneKills ?? 0
		const currentLocation = char.currentLocation ?? "city"
		const zone = findNode(ACT_1, currentLocation)
		const isBossNodeRareKill =
			args.monsterRarity === "rare" && zone?.kind === "boss"
		const isMinibossKill =
			args.monsterRarity === "rare" && !isBossNodeRareKill
		const isBossKill = args.monsterRarity === "unique"
		const grantsCampTier = isMinibossKill || isBossKill
		if (grantsCampTier) {
			updates.currentZoneKills = 0
			const completed = char.completedZones ?? []
			if (!completed.includes(currentLocation)) {
				updates.completedZones = [...completed, currentLocation]
			}
			// Both miniboss-victory and act-boss-kill are 100% bag-retention
			// tiers (see derivePhase + CONTEXT.md → Bag retention tiers).
			updates.inCamp = true
			// Per CONTEXT.md → Zone Miniboss: continuing past the panel resets
			// the bar to 0 and rerolls the schedule. Only meaningful for
			// regular combat zones — boss nodes have no time bar.
			if (zone && zone.kind === "combat") {
				const plan = zone.encounterPlan ?? DEFAULT_ENCOUNTER_PLAN
				updates.campThresholdsMs = rollCampThresholdsMs(plan)
				updates.zoneStartedAt = Date.now()
				updates.lastCampIndex = undefined
			}
		} else {
			updates.currentZoneKills = currentZoneKills + 1
			// Defense-in-depth: a camp-tier kill flips `inCamp = true` and
			// expects the client to call `exitCamp` via dismissMinibossModal
			// before resuming normal combat. If a client skips the dismiss and
			// keeps farming, leaving `inCamp` set would grant 100% retention
			// to subsequent bag commits. Clearing it on every non-camp-tier
			// kill closes that gap without changing the legitimate flow.
			// Gated on `char.inCamp` so the patch + reactive-query invalidation
			// only fire on the rare flip transition, not every kill.
			if (char.inCamp) updates.inCamp = false
		}

		// Potion drop — independent of the equipment roll. At the 10-potion cap
		// the roll is wasted silently (per CONTEXT.md → Potion drops).
		const currentPotions = char.potions ?? 0
		const potionDropped =
			currentPotions < MAX_POTIONS && Math.random() < POTION_DROP_CHANCE
		if (potionDropped) {
			updates.potions = currentPotions + 1
		}

		// Incenso Etéreo drop — independent roll, uncapped (see
		// ETHEREAL_INCENSE_DROP_CHANCE). Per CONTEXT.md → Incenso Etéreo.
		const incenseDropped = Math.random() < ETHEREAL_INCENSE_DROP_CHANCE
		if (incenseDropped) {
			updates.etherealIncense = (char.etherealIncense ?? 0) + 1
		}

		if (isBossKill) {
			const counts =
				(char.bossKillCounts as Record<string, number> | undefined) ?? {}
			updates.bossKillCounts = {
				...counts,
				[args.monsterId]: (counts[args.monsterId] ?? 0) + 1,
			}
		}

		await ctx.db.patch(args.characterId, updates)

		// Drop routing per CONTEXT.md → Drop rates:
		//   - act boss (unique): 2-3 items, guaranteed Rare, 75/25 Rare/Magic
		//   - any rare kill (zone miniboss or gauntlet): 2 items, 1 guaranteed Rare
		//   - normal / magic mob: standard rolldrop
		const zoneSession = char.currentZoneSession
		const drops: Array<{ id: Id<"items">; data: Doc<"items">["data"] }> = []
		if (zoneSession) {
			const isAnyRareKill = isMinibossKill || isBossNodeRareKill
			const rolledDrops = isBossKill
				? rollBossDrops({ monsterLevel })
				: isAnyRareKill
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
					droppedFrom: template.id,
					droppedFromLevel: monsterLevel,
				})
				drops.push({ id: insertedId, data: drop })
			}
		}

		return {
			xpGained: xpAwarded,
			levelsGained,
			drops,
			potionDropped,
			incenseDropped,
		}
	},
})

export const usePotion = mutation({
	args: { characterId: v.id("characters"), sessionToken: v.string() },
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)

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

		const count = char.etherealIncense ?? 0
		if (count <= 0) throw new ConvexError("No incense to use")

		// Boss nodes are commitment — incense is banned inside them per
		// CONTEXT.md → Incenso Etéreo / Act Boss. Server-side gate so a
		// keyboard shortcut or tampered client can't bypass the HUD's
		// greyed-out button.
		const currentLocation = char.currentLocation ?? "city"
		const zone = findNode(ACT_1, currentLocation)
		if (zone?.kind === "boss") {
			throw new ConvexError("Cannot use incense inside a boss node")
		}

		// `inCamp` is NOT flipped here. Incense may be queued during "engaged"
		// (the cinematic only fires after the current fight finishes), so the
		// client calls `enterCampViaIncense` separately when the cinematic
		// actually begins. The counter still decrements on use so a kill
		// landing between use+enter can't race the consume.
		await ctx.db.patch(args.characterId, {
			etherealIncense: count - 1,
		})
		return { etherealIncense: count - 1 }
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

		if (char.zoneStartedAt === undefined)
			throw new ConvexError("Not in a zone")

		await ctx.db.patch(args.characterId, { inCamp: true })
		return { inCamp: true }
	},
})

export const syncHp = mutation({
	args: {
		characterId: v.id("characters"),
		sessionToken: v.string(),
		hpCurrent: v.number(),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)

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
	args: { characterId: v.id("characters"), sessionToken: v.string() },
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)

		const classDef = findClassDefinition(char.classId)
		const equippedItems = await loadEquippedSet(ctx, args.characterId)
		const stats = computeCharacterStats({
			classDef,
			level: char.level,
			equippedItems,
		})
		const maxHp = stats.maxLife
		const refilledPotions = refillPotionsToFloor(char)

		await ctx.db.patch(args.characterId, {
			hpCurrent: maxHp,
			potions: refilledPotions,
		})
		return { hpCurrent: maxHp, potions: refilledPotions }
	},
})

export const respawnDead = mutation({
	args: { characterId: v.id("characters"), sessionToken: v.string() },
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)

		// Wipe the zone bag — death loses everything staged.
		if (char.currentZoneSession) {
			await deleteZoneBag(ctx, char.currentZoneSession)
		}

		if (char.hardcore) {
			// Soft-delete: mark dead, cascade-delete owned items, but keep the
			// character document so it can appear in leaderboard "Fallen Heroes".
			const ownedItems = await ctx.db
				.query("items")
				.withIndex("by_character_kind", (q) =>
					q.eq("characterId", args.characterId),
				)
				.collect()
			await Promise.all(ownedItems.map((item) => ctx.db.delete(item._id)))
			await ctx.db.patch(args.characterId, {
				dead: true,
				...clearPerVisitZoneState(),
				currentLocation: undefined,
				travelDestination: undefined,
				travelStartedAt: undefined,
				travelArrivesAt: undefined,
				activeSessionToken: undefined,
			})
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

		const refilledPotions = refillPotionsToFloor(char)

		await ctx.db.patch(args.characterId, {
			hpCurrent: maxHp,
			xp,
			potions: refilledPotions,
			...clearPerVisitZoneState(),
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
		sessionToken: v.string(),
		zoneId: v.string(),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)

		const zone = findNode(ACT_1, args.zoneId)
		if (!zone || (zone.kind !== "combat" && zone.kind !== "boss"))
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
		//
		// Server-authoritative camp scheduling: roll the camp thresholds here so
		// a tampered client can't fabricate an early `enterCamp` claim. Falls back
		// to DEFAULT_ENCOUNTER_PLAN for safety, though every combat node in act-1
		// declares its own plan today. See docs/plans/in-progress.md
		// "Server-authoritative camp/phase derivation".
		// Boss nodes have no camps — empty threshold array so the client's
		// encounter schedule never fires onCampTriggered.
		const encounterPlan = zone.encounterPlan ?? DEFAULT_ENCOUNTER_PLAN
		const campThresholdsMs =
			zone.kind === "boss" ? [] : rollCampThresholdsMs(encounterPlan)
		const zoneStartedAt = Date.now()
		// Spread the helper first so every per-visit field (including future
		// additions like `lastCampIndex`) gets a clean slate; the explicit
		// writes below then set this visit's session/timestamp/thresholds.
		await ctx.db.patch(args.characterId, {
			...clearPerVisitZoneState(),
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

		const zoneStartedAt = char.zoneStartedAt
		if (zoneStartedAt === undefined) throw new ConvexError("Not in a zone")

		// Boss nodes never have camps — reject any client attempt.
		const currentLocation = char.currentLocation ?? "city"
		const zone = findNode(ACT_1, currentLocation)
		if (zone?.kind === "boss") throw new ConvexError("No camps in boss nodes")

		const thresholds = char.campThresholdsMs ?? []
		if (
			args.thresholdIndex < 0 ||
			args.thresholdIndex >= thresholds.length
		)
			throw new ConvexError("Invalid camp threshold")

		// Idempotent on the same index: if a network retry or double-fire from the
		// client lands a second enterCamp while we're already in camp, swallow it
		// instead of throwing — the player is already where they want to be.
		if (char.inCamp) return { inCamp: true }

		// Strictly-increasing index: each camp threshold is single-use per visit.
		// Without this, a player could enter camp[0], exit, then re-call
		// enterCamp(0) any time later — the elapsed-time gate still passes
		// because time only moves forward, so inCamp would flip back to true
		// and grant another 100% retention exit.
		if (
			char.lastCampIndex !== undefined &&
			args.thresholdIndex <= char.lastCampIndex
		) {
			throw new ConvexError("Camp threshold already consumed")
		}

		const threshold = thresholds[args.thresholdIndex]
		const elapsed = Date.now() - zoneStartedAt
		if (elapsed < threshold - ENTER_CAMP_GRACE_MS) {
			throw new ConvexError("Camp threshold not reached")
		}

		await ctx.db.patch(args.characterId, {
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
		await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)

		await ctx.db.patch(args.characterId, { inCamp: false })
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
// crystal was consolidated into this; `windCrystals` schema field stays
// for legacy data only. City arrival heals + refills potion (the original
// "safety hub" contract); other nodes just transport. Wipes the zone bag
// on use — bag-retention tiers land in a later PR.
export const useTeleportStone = mutation({
	args: {
		characterId: v.id("characters"),
		sessionToken: v.string(),
		// Optional for backward-compat with call sites that haven't been
		// updated yet — undefined is interpreted as `"city"`.
		destinationNodeId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		const char = await loadOwnedCharacterWithSession(ctx, authUser._id, args.characterId, args.sessionToken)

		const stones = char.teleportStones ?? 0
		if (stones <= 0) throw new ConvexError("No teleport stones")

		const destinationNodeId = args.destinationNodeId ?? "city"

		// Destination validation runs for non-city targets only. "city" is
		// always available (seeded into `unlockedNodes` on character creation,
		// no zone-gate upstream). Checks are ordered cheapest-first so a bad
		// id fails before we walk ACT_1.nodes via findNode.
		if (destinationNodeId !== "city") {
			if (char.travelDestination !== undefined)
				throw new ConvexError("Already traveling")
			const fromId = char.currentLocation ?? "city"
			if (fromId === destinationNodeId)
				throw new ConvexError("Already at destination")

			const unlocked = char.unlockedNodes ?? ["city"]
			if (!unlocked.includes(destinationNodeId))
				throw new ConvexError("Destination not yet unlocked")

			const destNode = findNode(ACT_1, destinationNodeId)
			if (!destNode)
				throw new ConvexError(`Unknown destination: ${destinationNodeId}`)

			if (!isNodeAccessible(destNode, char.completedZones))
				throw new ConvexError("zone-locked")
		}

		// Defensively wipe the zone bag here — the normal flow routes the
		// player through ExitZoneModal → `exitZone` before this mutation
		// fires, but if the modal is bypassed (page refresh, network blip,
		// direct SDK call) any items still tagged to the session would
		// leak into the items table: this mutation clears
		// `currentZoneSession` below, so without a wipe the session id is
		// lost and `enterZone`'s `if (char.currentZoneSession)` guard can
		// never reach them again.
		if (char.currentZoneSession) {
			await deleteZoneBag(ctx, char.currentZoneSession)
		}
		const startedAt = Date.now()
		const arrivesAt =
			startedAt + teleportStoneTravelSeconds(destinationNodeId) * 1000

		if (destinationNodeId === "city") {
			// Heal + potion refill are applied *immediately* on use, not on
			// arrival via `arriveAtTravel`. This is intentional: the player is
			// in mid-travel for ~1.5s (panic exit from combat), and the
			// "safety" semantic requires that they can't keep taking damage
			// or die during the trip. Treat the city stone as the moment of
			// safety, not the arrival.
			const classDef = findClassDefinition(char.classId)
			const equippedItems = await loadEquippedSet(ctx, args.characterId)
			const stats = computeCharacterStats({
				classDef,
				level: char.level,
				equippedItems,
			})
			const refilledPotions = refillPotionsToFloor(char)

			await ctx.db.patch(args.characterId, {
				teleportStones: stones - 1,
				hpCurrent: stats.maxLife,
				potions: refilledPotions,
				...clearPerVisitZoneState(),
				travelDestination: "city",
				travelStartedAt: startedAt,
				travelArrivesAt: arrivesAt,
			})
			return { teleportStones: stones - 1, startedAt, arrivesAt }
		}

		await ctx.db.patch(args.characterId, {
			teleportStones: stones - 1,
			...clearPerVisitZoneState(),
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
