import {
	chance,
	defaultRng,
	randInt,
	randSymmetric,
	type Rng,
} from "../../lib/rng";
import type { MonsterRarity } from "../monsters";
import type { WorldNode } from "./types";

export interface ZoneEncounterPlan {
	calmariaBudgetSeconds: number;
	gapBetweenSpawns: { min: number; max: number };
	campFractions: readonly number[];
	ambushes?: {
		fractions: readonly number[];
		packSize: { min: number; max: number };
		gapWithinPackMs: number;
		magicChance: number;
	};
}

export const DEFAULT_ENCOUNTER_PLAN: ZoneEncounterPlan = {
	calmariaBudgetSeconds: 35,
	gapBetweenSpawns: { min: 1.5, max: 3 },
	campFractions: [0.5],
};

const BOSS_WARMUP_GAP_SECONDS = { min: 1.5, max: 3 };

export function encounterPlanForNode(
	node: Pick<WorldNode, "encounterPlan" | "bossNode"> | null | undefined,
): ZoneEncounterPlan {
	const warmup = node?.bossNode?.warmupSeconds;
	if (warmup) {
		return {
			calmariaBudgetSeconds: warmup,
			gapBetweenSpawns: BOSS_WARMUP_GAP_SECONDS,
			campFractions: [],
		};
	}
	return node?.encounterPlan ?? DEFAULT_ENCOUNTER_PLAN;
}

export function rollSpawnGapMs(
	plan: ZoneEncounterPlan,
	rng: Rng = defaultRng,
): number {
	const { min, max } = plan.gapBetweenSpawns;
	return randInt(Math.round(min * 1000), Math.round(max * 1000), rng);
}

const BUDGET_JITTER = 0.25;

export function rollZoneBudgetMs(
	plan: ZoneEncounterPlan,
	varies: boolean,
	rng: Rng = defaultRng,
): number {
	const budgetMs = plan.calmariaBudgetSeconds * 1000;
	if (!varies) return budgetMs;
	return Math.round(budgetMs * (1 + randSymmetric(BUDGET_JITTER, rng)));
}

export interface VisitSchedule {
	zoneBudgetMs: number;
	campThresholdsMs: number[];
}

export function rollVisitSchedule(
	node: Pick<WorldNode, "encounterPlan" | "bossNode">,
	rng: Rng = defaultRng,
): VisitSchedule {
	const plan = encounterPlanForNode(node);
	const zoneBudgetMs = rollZoneBudgetMs(plan, !node.bossNode, rng);
	return {
		zoneBudgetMs,
		campThresholdsMs: rollCampThresholdsMs(plan, zoneBudgetMs, rng),
	};
}

const CAMP_JITTER = 0.1;

export function rollCampThresholdsMs(
	plan: ZoneEncounterPlan,
	budgetMs: number,
	rng: Rng = defaultRng,
): number[] {
	return plan.campFractions
		.map((fraction) =>
			Math.round((fraction + randSymmetric(CAMP_JITTER, rng)) * budgetMs),
		)
		.toSorted((a, b) => a - b);
}

const AMBUSH_JITTER = 0.15;

export type AmbushSchedule = { thresholdMs: number; packSize: number };

export function rollAmbushSchedule(
	plan: ZoneEncounterPlan,
	budgetMs: number,
	rng: Rng = defaultRng,
): AmbushSchedule[] {
	if (!plan.ambushes) return [];
	const { fractions, packSize } = plan.ambushes;
	return fractions
		.map((fraction) => ({
			thresholdMs: Math.round(
				(fraction + randSymmetric(AMBUSH_JITTER, rng)) * budgetMs,
			),
			packSize: randInt(packSize.min, packSize.max, rng),
		}))
		.toSorted((a, b) => a.thresholdMs - b.thresholdMs);
}

export function rollAmbushRarity(
	magicChance: number,
	rng: Rng = defaultRng,
): MonsterRarity {
	return chance(magicChance, rng) ? "magic" : "normal";
}
