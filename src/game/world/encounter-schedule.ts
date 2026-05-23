// Encounter pacing data per combat zone. Replaces the hard-coded
// KILLS_TO_THRESHOLD = 30 and SEARCH_DELAY_MS = 1500ms with values that
// scale per zone, so deeper zones feel longer and the calmaria between
// spawns isn't a flat metronome.
//
// Future sections layer on top of this shape:
//   - `ambushes`: deliberate packs of mobs inserted at random schedule slots
//   - `camps`: anchored rest points (1 in small zones, 2 in large)
//   - true time-bar UI showing cumulative calmaria seconds elapsed
//
// For now (Section 1) only the two top-level knobs are wired: number of
// encounters before the miniboss, and the gap range each one is rolled
// from.

import { randInt, randSymmetric } from "../../lib/rng";

export interface ZoneEncounterPlan {
	/**
	 * Total calmaria (out-of-combat) seconds the player accumulates before the
	 * miniboss spawns. The number of regular mobs faced varies with the rolled
	 * gaps — at gap range 1.5–3s, a 35s budget averages ~15 encounters but
	 * can swing ±3. Time is the fixed contract; mob count is the variable.
	 */
	calmariaBudgetSeconds: number;
	/** Random calmaria between spawns (seconds). Each spawn rolls its own gap. */
	gapBetweenSpawns: { min: number; max: number };
	/**
	 * Camp positions as fractions of the budget (0–1). Each entry triggers a
	 * camp cinematic when cumulative calmaria crosses
	 * `calmariaBudgetSeconds × fraction` (with a small jitter applied on
	 * activation). 1 camp for early zones, 2 for late zones — anchored at
	 * ~50% or at ~33%/~66% respectively. See CONTEXT.md → Acampamento.
	 */
	campFractions: readonly number[];
	/**
	 * Ambush packs anchored to fractions of the budget (0–1). When the
	 * calmaria crosses an entry, the next N spawns fire back-to-back with
	 * `gapWithinPackMs` instead of the normal range, with a boosted magic
	 * rate. See CONTEXT.md → Ambush events. Omit to disable ambushes for
	 * the zone.
	 */
	ambushes?: {
		/** Anchors as fractions of the budget. 1–2 per zone in act 1. */
		fractions: readonly number[];
		/** Random pack size (mobs) per ambush. */
		packSize: { min: number; max: number };
		/** Gap between mobs inside an ambush pack. */
		gapWithinPackMs: number;
		/** Chance a mob spawned inside an ambush rolls as magic. */
		magicChance: number;
	};
}

/**
 * Fallback for non-combat views (city, map). The hook isn't active there,
 * so the values never run — but the params type still requires a plan, so
 * we export a labeled default instead of inlining magic numbers at call
 * sites.
 */
export const DEFAULT_ENCOUNTER_PLAN: ZoneEncounterPlan = {
	calmariaBudgetSeconds: 35,
	gapBetweenSpawns: { min: 1.5, max: 3 },
	campFractions: [0.5],
};

/** Roll a fresh calmaria duration (ms) for the next spawn. */
export function rollSpawnGapMs(plan: ZoneEncounterPlan): number {
	const { min, max } = plan.gapBetweenSpawns;
	return randInt(Math.round(min * 1000), Math.round(max * 1000));
}

// Jitter applied to each camp anchor on activation so the player can't decode
// the exact instant a camp fires. With anchors in [0.33, 0.66] range a ±10%
// scatter keeps every roll safely between 20% and 80% of the budget.
const CAMP_JITTER = 0.1;

/**
 * Sort the camp anchor fractions into the actual cumulative-calmaria
 * thresholds (ms) where each camp will fire. Called once per zone activation
 * so the same camp anchor can fire at slightly different times across runs.
 */
export function rollCampThresholdsMs(plan: ZoneEncounterPlan): number[] {
	const budgetMs = plan.calmariaBudgetSeconds * 1000;
	return plan.campFractions
		.map((fraction) =>
			Math.round((fraction + randSymmetric(CAMP_JITTER)) * budgetMs),
		)
		.sort((a, b) => a - b);
}

// Same shape as CAMP_JITTER. Ambushes get a slightly wider scatter (±15%)
// because there are fewer of them per zone, so the surprise factor leans on
// position variance instead of count variance.
const AMBUSH_JITTER = 0.15;

/**
 * Per-ambush activation data — when (ms) it fires, and how many mobs the
 * pack contains. The pack size is rolled per-ambush so back-to-back runs
 * don't always face the same length.
 */
export type AmbushSchedule = { thresholdMs: number; packSize: number };

/**
 * Roll the cumulative-calmaria thresholds for each ambush in the plan, plus
 * each pack's size. Returns empty when the plan has no `ambushes` block.
 * Called once per zone activation, mirroring `rollCampThresholdsMs`.
 */
export function rollAmbushSchedule(plan: ZoneEncounterPlan): AmbushSchedule[] {
	if (!plan.ambushes) return [];
	const { fractions, packSize } = plan.ambushes;
	const budgetMs = plan.calmariaBudgetSeconds * 1000;
	return fractions
		.map((fraction) => ({
			thresholdMs: Math.round(
				(fraction + randSymmetric(AMBUSH_JITTER)) * budgetMs,
			),
			packSize: randInt(packSize.min, packSize.max),
		}))
		.sort((a, b) => a.thresholdMs - b.thresholdMs);
}
