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

import { randInt } from "#/lib/rng";

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
// the exact instant a camp fires. Small enough that a 50% anchor stays safely
// away from boss-spawn (≤80%) and from zone start (≥20%).
const CAMP_JITTER = 0.03;

/**
 * Sort the camp anchor fractions into the actual cumulative-calmaria
 * thresholds (ms) where each camp will fire. Called once per zone activation
 * so the same camp anchor can fire at slightly different times across runs.
 */
export function rollCampThresholdsMs(plan: ZoneEncounterPlan): number[] {
	const budgetMs = plan.calmariaBudgetSeconds * 1000;
	return plan.campFractions
		.map((fraction) => {
			const jittered =
				fraction + (Math.random() * 2 - 1) * CAMP_JITTER;
			return Math.round(jittered * budgetMs);
		})
		.sort((a, b) => a - b);
}
