import { and, eq, gt, sql } from "drizzle-orm";
import type { SQLiteUpdateSetSource } from "drizzle-orm/sqlite-core";
import { z } from "zod";

import {
	ELEMENT_SWITCH_COOLDOWN_MS,
	POTION_REFILL_FLOOR,
} from "#/game/combat/constants";
import { resolvePotionUse } from "#/game/combat/potion";
import {
	resolveKill,
	resolveKillTarget,
	resolveKillXp,
} from "#/game/combat/record-kill";
import { resolveVitalSync } from "#/game/combat/vitals";
import { withoutIds } from "#/game/items/equip-resolution";
import { MONSTER_RARITIES } from "#/game/monsters/types";
import { applyDeathXpPenalty } from "#/game/progression/levels";
import { computeStatCache } from "#/game/stats/cache";
import { SELECTABLE_ELEMENTS } from "#/game/stats/types";
import { ACT_1, findNode } from "#/game/world";
import {
	resolveCampEntry,
	resolveTeleport,
	resolveTravelStart,
	resolveZoneEntry,
	TRAVEL_ARRIVAL_GRACE_MS,
} from "#/game/world/zone-actions";

import { characters, items } from "../../db/schema";
import { loadEquipped } from "../../item-reads";
import { appendToBag, CLEARED_ZONE, toBagEntries } from "../../zone-bag";
import { fail } from "../errors";
import {
	characterSessionProcedure,
	router,
	type SessionCharacter,
} from "../init";

// Mirrors convex/combat.ts: kills, vitals, zone visits, camps and travel.
// Every procedure is one UPDATE of the character row (the combat state and
// progression live on it), except hardcore death, which also deletes items.
//
// Trust model unchanged from Convex: the client still reports kills and HP
// (threats #1 and #2 in docs/security/threat-model.md); the server decides
// every value.
//
// Renamed from Convex, since a `use` prefix trips the React hooks lint rule on
// the client: usePotion → consumePotion, useEtherealIncense →
// consumeEtherealIncense, useTeleportStone → consumeTeleportStone.

type CharacterUpdate = SQLiteUpdateSetSource<typeof characters>;

function byId(character: SessionCharacter) {
	return eq(characters.id, character.id);
}

// Reaching a safe state (city, teleport to city, softcore respawn) tops the
// potion count up to the floor; anything above it is kept.
function refilledPotions(potions: number): number {
	return Math.max(potions, POTION_REFILL_FLOOR);
}

export const combatRouter = router({
	recordKill: characterSessionProcedure
		.input(
			z.object({
				monsterId: z.string(),
				monsterLevel: z.number(),
				monsterRarity: z.enum(MONSTER_RARITIES),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { character } = ctx;
			const target = resolveKillTarget(input.monsterId, input.monsterLevel);
			if (!target) fail(`Unknown monster: ${input.monsterId}`);

			// The stat engine only runs on a level-up; every other kill reads the
			// cached stats on the row.
			const gain = resolveKillXp(character, target);
			const levelUpStats =
				gain.levelsGained > 0
					? computeStatCache(
							{ ...character, level: gain.level },
							withoutIds(await loadEquipped(ctx.db, character.id)),
						)
					: null;

			const now = Date.now();
			const outcome = resolveKill({
				character,
				monsterId: input.monsterId,
				monsterRarity: input.monsterRarity,
				target,
				gain,
				levelUpStats,
				now,
			});
			// One row written per kill: the drops ride on the same UPDATE.
			// `resolveKill` only rolls drops inside a zone visit.
			const update: CharacterUpdate = { ...outcome.update };
			const zoneSession = character.currentZoneSession;
			const drops = toBagEntries(
				outcome.drops,
				target.templateId,
				target.monsterLevel,
				now,
			);
			if (zoneSession && drops.length > 0) {
				update.zoneBag = appendToBag(drops, zoneSession);
			}
			const [written] = await ctx.db
				.update(characters)
				.set(update)
				.where(byId(character))
				.returning({ currentZoneSession: characters.currentZoneSession });
			// The append is skipped if another request ended the visit meanwhile;
			// then the drops aren't in any bag and the client mustn't show them.
			const landed = written?.currentZoneSession === zoneSession ? drops : [];

			return {
				xpGained: outcome.xpGained,
				levelsGained: outcome.levelsGained,
				potionDropped: outcome.potionDropped,
				incenseDropped: outcome.incenseDropped,
				newMaxLife: outcome.newMaxLife,
				newMaxBarrier: outcome.newMaxBarrier,
				// No reactivity on D1: the client appends these to its bag cache.
				drops: landed,
			};
		}),

	consumePotion: characterSessionProcedure
		.input(z.object({ clientHp: z.number().optional() }))
		.mutation(async ({ ctx, input }) => {
			const { character } = ctx;
			const result = resolvePotionUse({
				potions: character.potions,
				maxLife: character.cachedMaxLife,
				prevHp: character.hpCurrent,
				clientHp: input.clientHp,
			});
			if (!result.ok) {
				fail(
					result.reason === "no-potions"
						? "No potions to use"
						: "Already at full HP",
				);
			}
			// Guarded on the count we read, so two concurrent drinks spend two
			// potions or fail.
			const [updated] = await ctx.db
				.update(characters)
				.set({
					hpCurrent: result.hpCurrent,
					potions: sql`${characters.potions} - 1`,
				})
				.where(and(byId(character), gt(characters.potions, 0)))
				.returning({ potions: characters.potions });
			if (!updated) fail("No potions to use");
			return { hpCurrent: result.hpCurrent, potions: updated.potions };
		}),

	// The cinematic is client-side; the server owns the counter. The other
	// gates (no overlapping camp) stay on the client, like in Convex.
	consumeEtherealIncense: characterSessionProcedure.mutation(
		async ({ ctx }) => {
			const { character } = ctx;
			if (character.etherealIncense <= 0) fail("No incense to use");
			if (findNode(ACT_1, character.currentLocation)?.kind === "boss") {
				fail("Cannot use incense inside a boss node");
			}
			const [updated] = await ctx.db
				.update(characters)
				.set({ etherealIncense: sql`${characters.etherealIncense} - 1` })
				.where(and(byId(character), gt(characters.etherealIncense, 0)))
				.returning({ etherealIncense: characters.etherealIncense });
			if (!updated) fail("No incense to use");
			return { etherealIncense: updated.etherealIncense };
		},
	),

	// Camp summoned by incense: no time gate, the consumed incense is the gate.
	// Kept apart from `enterCamp` so the time-gated path can't be widened.
	enterCampViaIncense: characterSessionProcedure.mutation(async ({ ctx }) => {
		if (ctx.character.zoneStartedAt === null) fail("Not in a zone");
		await ctx.db
			.update(characters)
			.set({ inCamp: true })
			.where(byId(ctx.character));
		return { inCamp: true };
	}),

	syncHp: characterSessionProcedure
		.input(
			z.object({
				hpCurrent: z.number(),
				barrierCurrent: z.number().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { character } = ctx;
			const { hpCurrent, patch } = resolveVitalSync({
				maxLife: character.cachedMaxLife,
				maxBarrier: character.cachedMaxBarrier,
				prevHp: character.hpCurrent,
				prevBarrier: character.barrierCurrent,
				clientHp: input.hpCurrent,
				clientBarrier: input.barrierCurrent,
			});
			// The common idle tick changes nothing and writes nothing.
			if (Object.keys(patch).length > 0) {
				await ctx.db.update(characters).set(patch).where(byId(character));
			}
			return { hpCurrent };
		}),

	enterCity: characterSessionProcedure.mutation(async ({ ctx }) => {
		const { character } = ctx;
		const potions = refilledPotions(character.potions);
		const alreadySafe =
			character.hpCurrent === character.cachedMaxLife &&
			character.barrierCurrent === character.cachedMaxBarrier &&
			potions === character.potions;
		if (alreadySafe) return { hpCurrent: character.cachedMaxLife, potions };
		await ctx.db
			.update(characters)
			.set({
				hpCurrent: character.cachedMaxLife,
				barrierCurrent: character.cachedMaxBarrier,
				potions,
			})
			.where(byId(character));
		return { hpCurrent: character.cachedMaxLife, potions };
	}),

	// Death. Softcore: XP penalty, back to the city, bag lost. Hardcore: the
	// character is soft-deleted for the leaderboard and loses every item.
	respawnDead: characterSessionProcedure.mutation(async ({ ctx }) => {
		const { character } = ctx;
		if (character.hardcore) {
			await ctx.db.batch([
				ctx.db.delete(items).where(eq(items.characterId, character.id)),
				ctx.db
					.update(characters)
					.set({
						...CLEARED_ZONE,
						dead: true,
						currentLocation: "city",
						travelDestination: null,
						travelStartedAt: null,
						travelArrivesAt: null,
						activeSessionToken: null,
					})
					.where(byId(character)),
			]);
			return { mode: "hardcore" as const, xpLost: 0 };
		}

		const { xp, xpLost } = applyDeathXpPenalty(character.xp);
		await ctx.db
			.update(characters)
			.set({
				...CLEARED_ZONE,
				hpCurrent: character.cachedMaxLife,
				barrierCurrent: character.cachedMaxBarrier,
				xp,
				potions: refilledPotions(character.potions),
				currentZoneKills: 0,
				currentLocation: "city",
				travelDestination: null,
				travelStartedAt: null,
				travelArrivesAt: null,
			})
			.where(byId(character));
		return { mode: "softcore" as const, xpLost };
	}),

	// New zone visit: fresh session id, camp schedule and full vitals. A bag
	// left over from a previous visit is wiped.
	enterZone: characterSessionProcedure
		.input(z.object({ zoneId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const { character } = ctx;
			const entry = resolveZoneEntry(input.zoneId, character);
			if (!entry.ok) fail(entry.error);

			const zoneSession = crypto.randomUUID();
			const zoneStartedAt = Date.now();
			await ctx.db
				.update(characters)
				.set({
					...CLEARED_ZONE,
					hpCurrent: character.cachedMaxLife,
					barrierCurrent: character.cachedMaxBarrier,
					currentZoneSession: zoneSession,
					currentZoneKills: 0,
					zoneStartedAt,
					campThresholdsMs: entry.campThresholdsMs,
				})
				.where(byId(character));
			return {
				zoneSession,
				zoneStartedAt,
				campThresholdsMs: entry.campThresholdsMs,
			};
		}),

	enterCamp: characterSessionProcedure
		.input(z.object({ thresholdIndex: z.number().int() }))
		.mutation(async ({ ctx, input }) => {
			const { character } = ctx;
			const decision = resolveCampEntry(
				character,
				input.thresholdIndex,
				Date.now(),
			);
			if (!decision.ok) fail(decision.error);
			if (!decision.alreadyInCamp) {
				await ctx.db
					.update(characters)
					.set({ inCamp: true, lastCampIndex: input.thresholdIndex })
					.where(byId(character));
			}
			return { inCamp: true };
		}),

	// "Seguir em frente" on the camp panel. No time gate.
	exitCamp: characterSessionProcedure.mutation(async ({ ctx }) => {
		if (ctx.character.inCamp) {
			await ctx.db
				.update(characters)
				.set({ inCamp: false })
				.where(byId(ctx.character));
		}
		return { inCamp: false };
	}),

	startTravel: characterSessionProcedure
		.input(z.object({ destinationNodeId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const { character } = ctx;
			const travel = resolveTravelStart(
				character,
				input.destinationNodeId,
				Date.now(),
			);
			if (!travel.ok) fail(travel.error);
			await ctx.db
				.update(characters)
				.set({
					travelDestination: input.destinationNodeId,
					travelStartedAt: travel.startedAt,
					travelArrivesAt: travel.arrivesAt,
				})
				.where(byId(character));
			return {
				startedAt: travel.startedAt,
				arrivesAt: travel.arrivesAt,
				durationMs: travel.arrivesAt - travel.startedAt,
			};
		}),

	// Idempotent: without an active travel it reports where the character is,
	// so a retried or stale arrival timer is not an error.
	arriveAtTravel: characterSessionProcedure.mutation(async ({ ctx }) => {
		const { character } = ctx;
		const destination = character.travelDestination;
		if (destination === null || character.travelArrivesAt === null) {
			return { arrivedAt: character.currentLocation };
		}
		if (Date.now() < character.travelArrivesAt - TRAVEL_ARRIVAL_GRACE_MS) {
			fail("Travel not complete");
		}
		const update: CharacterUpdate = {
			currentLocation: destination,
			travelDestination: null,
			travelStartedAt: null,
			travelArrivesAt: null,
		};
		// First arrival unlocks the node for teleport stones.
		if (!character.unlockedNodes.includes(destination)) {
			update.unlockedNodes = [...character.unlockedNodes, destination];
		}
		await ctx.db.update(characters).set(update).where(byId(character));
		return { arrivedAt: destination };
	}),

	// Jump to any visited node (the city by default, which also heals and
	// refills potions). Used mid-zone, it ends the visit and wipes the bag.
	consumeTeleportStone: characterSessionProcedure
		.input(z.object({ destinationNodeId: z.string().optional() }))
		.mutation(async ({ ctx, input }) => {
			const { character } = ctx;
			const destination = input.destinationNodeId ?? "city";
			const teleport = resolveTeleport(character, destination, Date.now());
			if (!teleport.ok) fail(teleport.error);

			const update: CharacterUpdate = {
				...CLEARED_ZONE,
				teleportStones: sql`${characters.teleportStones} - 1`,
				travelDestination: destination,
				travelStartedAt: teleport.startedAt,
				travelArrivesAt: teleport.arrivesAt,
			};
			if (teleport.toCity) {
				update.hpCurrent = character.cachedMaxLife;
				update.barrierCurrent = character.cachedMaxBarrier;
				update.potions = refilledPotions(character.potions);
			}
			const [updated] = await ctx.db
				.update(characters)
				.set(update)
				.where(and(byId(character), gt(characters.teleportStones, 0)))
				.returning({ teleportStones: characters.teleportStones });
			if (!updated) fail("No teleport stones");
			return {
				teleportStones: updated.teleportStones,
				startedAt: teleport.startedAt,
				arrivesAt: teleport.arrivesAt,
			};
		}),

	// Mage attunement (CONTEXT.md → Elemental Attunement), 5 s cooldown. Like
	// the Convex mutation, it leaves the stat cache alone: none of the cached
	// stats depend on the element.
	switchElement: characterSessionProcedure
		.input(z.object({ element: z.enum(SELECTABLE_ELEMENTS) }))
		.mutation(async ({ ctx, input }) => {
			const { character } = ctx;
			if (character.classId !== "mage") fail("Only mages can switch elements");
			if (input.element === character.selectedElement) return;
			const now = Date.now();
			if (
				character.lastElementSwitchAt !== null &&
				now - character.lastElementSwitchAt < ELEMENT_SWITCH_COOLDOWN_MS
			) {
				fail("Element switch on cooldown");
			}
			await ctx.db
				.update(characters)
				.set({ selectedElement: input.element, lastElementSwitchAt: now })
				.where(byId(character));
		}),
});
