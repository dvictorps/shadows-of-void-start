import { computeArmorMitigation, computeEvasionAvoid } from "./compute";

const REFERENCE_HIT_PER_LEVEL = 5;
const MIN_REFERENCE_HIT = 5;
const REFERENCE_ACCURACY_PER_LEVEL = 10;

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
