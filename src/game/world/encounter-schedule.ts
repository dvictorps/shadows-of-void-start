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
	/** Number of regular kills the player must clear before the miniboss spawns. */
	encountersBeforeBoss: number;
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
	encountersBeforeBoss: 15,
	gapBetweenSpawns: { min: 1.5, max: 3 },
};

/** Roll a fresh calmaria duration (ms) for the next spawn. */
export function rollSpawnGapMs(plan: ZoneEncounterPlan): number {
	const { min, max } = plan.gapBetweenSpawns;
	return randInt(Math.round(min * 1000), Math.round(max * 1000));
}
