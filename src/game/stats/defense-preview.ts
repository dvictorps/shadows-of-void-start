import { computeArmorMitigation, computeEvasionAvoid } from "./compute";

// A "typical enemy" at a zone level, for the stats sheet's previews only;
// combat reads the real hit and the real monster accuracy. Calibrated
// against act 1's monster baseline (goblin: 2-4 physical at level 1,
// scaling ~1.06^(L-1)).
const REFERENCE_HIT_PER_LEVEL = 5;
const MIN_REFERENCE_HIT = 5;
const REFERENCE_ACCURACY_PER_LEVEL = 10;

/**
 * How much of a typical hit at `enemyLevel` the character's armor absorbs,
 * and how often their evasion dodges such an enemy, both in percent.
 */
export function defensePreview(
	armor: number,
	evasion: number,
	enemyLevel: number,
) {
	const referenceHit = Math.max(
		MIN_REFERENCE_HIT,
		enemyLevel * REFERENCE_HIT_PER_LEVEL,
	);
	return {
		armorReductionPct: computeArmorMitigation(armor, referenceHit).reductionPct,
		evasionAvoidPct: computeEvasionAvoid(
			evasion,
			enemyLevel * REFERENCE_ACCURACY_PER_LEVEL,
		).avoidPct,
	};
}
