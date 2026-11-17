import { and, eq, gt, sql } from "drizzle-orm";
import type { SQLiteUpdateSetSource } from "drizzle-orm/sqlite-core";
import { z } from "zod";

import {
	ELEMENT_SWITCH_COOLDOWN_MS,
	POTION_REFILL_FLOOR,
} from "#/game/combat/constants";
import { resolveKillPace } from "#/game/combat/kill-pace";
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
import { SERVER_ERRORS } from "#/lib/server-errors";

import { characters, items } from "../../db/schema";
import { loadEquipped } from "../../item-reads";
import { appendToBag, CLEARED_ZONE, toBagEntries } from "../../zone-bag";
import { fail } from "../errors";
import {
	characterSessionProcedure,
	router,
	type SessionCharacter,
} from "../init";

type CharacterUpdate = SQLiteUpdateSetSource<typeof characters>;

function byId(character: SessionCharacter) {
	return eq(characters.id, character.id);
}

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
				clientHp: z.number().optional(),
				clientBarrier: z.number().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { character } = ctx;
			const claim = resolveKillTarget(input, character);
			if (!claim.ok) fail(claim.error);
			const { target } = claim;
			const now = Date.now();
			const pace = resolveKillPace(
				target.monsterRarity,
				claim.zone,
				character,
				now,
			);
			if (!pace.ok) fail(pace.error);

			const gain = resolveKillXp(character, target);
			const levelUpStats =
				gain.levelsGained > 0
					? computeStatCache(
							{ ...character, level: gain.level },
							withoutIds(await loadEquipped(ctx.db, character.id)),
						)
					: null;

			const outcome = resolveKill({
				character,
				monsterId: input.monsterId,
				target,
				gain,
				levelUpStats,
				now,
			});
			const vitals =
				input.clientHp === undefined || levelUpStats
					? {}
					: resolveVitalSync({
							maxLife: character.cachedMaxLife,
							maxBarrier: character.cachedMaxBarrier,
							prevHp: character.hpCurrent,
							prevBarrier: character.barrierCurrent,
							clientHp: input.clientHp,
							clientBarrier: input.clientBarrier,
						}).patch;
			const patch = { ...vitals, ...outcome.update };
			const update: CharacterUpdate = { ...patch };
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
			const landed = written?.currentZoneSession === zoneSession ? drops : [];

			return {
				xpGained: outcome.xpGained,
				levelsGained: outcome.levelsGained,
				potionDropped: outcome.potionDropped,
				incenseDropped: outcome.incenseDropped,
				newMaxLife: outcome.newMaxLife,
				newMaxBarrier: outcome.newMaxBarrier,
				character: patch,
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
						? SERVER_ERRORS.noPotions
						: SERVER_ERRORS.fullLife,
				);
			}
			const [updated] = await ctx.db
				.update(characters)
				.set({
					hpCurrent: result.hpCurrent,
					potions: sql`${characters.potions} - 1`,
				})
				.where(and(byId(character), gt(characters.potions, 0)))
				.returning({ potions: characters.potions });
			if (!updated) fail(SERVER_ERRORS.noPotions);
			return { hpCurrent: result.hpCurrent, potions: updated.potions };
		}),

	consumeEtherealIncense: characterSessionProcedure.mutation(
		async ({ ctx }) => {
			const { character } = ctx;
			if (character.etherealIncense <= 0) fail(SERVER_ERRORS.noIncense);
			if (findNode(ACT_1, character.currentLocation)?.kind === "boss") {
				fail(SERVER_ERRORS.incenseInBoss);
			}
			const [updated] = await ctx.db
				.update(characters)
				.set({ etherealIncense: sql`${characters.etherealIncense} - 1` })
				.where(and(byId(character), gt(characters.etherealIncense, 0)))
				.returning({ etherealIncense: characters.etherealIncense });
			if (!updated) fail(SERVER_ERRORS.noIncense);
			return { etherealIncense: updated.etherealIncense };
		},
	),

	enterCampViaIncense: characterSessionProcedure.mutation(async ({ ctx }) => {
		if (ctx.character.zoneStartedAt === null) fail(SERVER_ERRORS.notInZone);
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
					zoneBudgetMs: entry.zoneBudgetMs,
				})
				.where(byId(character));
			return {
				zoneSession,
				zoneStartedAt,
				campThresholdsMs: entry.campThresholdsMs,
				zoneBudgetMs: entry.zoneBudgetMs,
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

	arriveAtTravel: characterSessionProcedure.mutation(async ({ ctx }) => {
		const { character } = ctx;
		const destination = character.travelDestination;
		if (destination === null || character.travelArrivesAt === null) {
			return { arrivedAt: character.currentLocation };
		}
		if (Date.now() < character.travelArrivesAt - TRAVEL_ARRIVAL_GRACE_MS) {
			fail(SERVER_ERRORS.travelNotComplete);
		}
		const update: CharacterUpdate = {
			currentLocation: destination,
			travelDestination: null,
			travelStartedAt: null,
			travelArrivesAt: null,
		};
		if (!character.unlockedNodes.includes(destination)) {
			update.unlockedNodes = [...character.unlockedNodes, destination];
		}
		await ctx.db.update(characters).set(update).where(byId(character));
		return { arrivedAt: destination };
	}),

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
			if (!updated) fail(SERVER_ERRORS.noTeleportStones);
			return {
				teleportStones: updated.teleportStones,
				travelDestination: destination,
				travelStartedAt: teleport.startedAt,
				travelArrivesAt: teleport.arrivesAt,
				...(teleport.toCity && {
					hpCurrent: character.cachedMaxLife,
					barrierCurrent: character.cachedMaxBarrier,
					potions: refilledPotions(character.potions),
				}),
			};
		}),

	switchElement: characterSessionProcedure
		.input(z.object({ element: z.enum(SELECTABLE_ELEMENTS) }))
		.mutation(async ({ ctx, input }) => {
			const { character } = ctx;
			if (character.classId !== "mage") fail(SERVER_ERRORS.onlyMagesSwitch);
			const unchanged = {
				selectedElement: input.element,
				lastElementSwitchAt: character.lastElementSwitchAt,
			};
			if (input.element === character.selectedElement) return unchanged;
			const now = Date.now();
			if (
				character.lastElementSwitchAt !== null &&
				now - character.lastElementSwitchAt < ELEMENT_SWITCH_COOLDOWN_MS
			) {
				fail(SERVER_ERRORS.elementSwitchCooldown);
			}
			await ctx.db
				.update(characters)
				.set({ selectedElement: input.element, lastElementSwitchAt: now })
				.where(byId(character));
			return { selectedElement: input.element, lastElementSwitchAt: now };
		}),
});
