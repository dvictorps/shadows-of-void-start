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
};

/** Roll a fresh calmaria duration (ms) for the next spawn. */
export function rollSpawnGapMs(plan: ZoneEncounterPlan): number {
	const { min, max } = plan.gapBetweenSpawns;
	return randInt(Math.round(min * 1000), Math.round(max * 1000));
}
