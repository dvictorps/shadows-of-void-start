import { randInt } from "#/lib/rng";
import type { MonsterElementDamage } from "../monsters/types";
import type { ComputedCharacterStats, SwingProfile } from "../stats/types";

const CRIT_CHANCE_FLOOR = 5;
const CRIT_CHANCE_CAP = 100;
const HIT_CHANCE_MIN = 0.05;
const HIT_CHANCE_MAX = 0.95;
const ARMOR_REDUCTION_CAP = 0.85;
const BASE_CRIT_MULTIPLIER = 50;

export interface ElementContribution {
	element: "Physical" | "Cold" | "Fire" | "Lightning" | "Void";
	min: number;
	max: number;
}

export interface DamageBreakdown {
	physical: number;
	cold: number;
	fire: number;
	lightning: number;
	void: number;
}

export interface RolledSwing {
	amount: number;
	isCrit: boolean;
	isMiss: boolean;
	isBlocked: boolean;
	breakdown: DamageBreakdown;
}

interface DefenderProfile {
	armor: number;
	evasion: number;
	accuracy: number;
	level: number;
	resistances: { cold: number; fire: number; lightning: number; void: number };
	blockChance?: number;
}

// ── Helpers ──

function clamp(n: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, n));
}

function hitChance(attackerAcc: number, defenderEva: number): number {
	if (attackerAcc <= 0 && defenderEva <= 0) return HIT_CHANCE_MAX;
	const raw = attackerAcc / (attackerAcc + defenderEva / 4);
	return clamp(raw, HIT_CHANCE_MIN, HIT_CHANCE_MAX);
}

// PoE-style armor: reduction scales with the size of the hit, not with the
// attacker's level. The same armor pool mitigates many small hits hard but
// barely dents one big hit, so armor reads as a "tank against trash" stat
// instead of a flat damage multiplier. Cap at 85% mirrors PoE's cap.
function applyArmor(physical: number, armor: number): number {
	if (armor <= 0 || physical <= 0) return physical;
	const reduction = clamp(
		armor / (armor + 10 * physical),
		0,
		ARMOR_REDUCTION_CAP,
	);
	return physical * (1 - reduction);
}

function applyResistance(elemental: number, resistance: number): number {
	if (elemental <= 0) return elemental;
	return elemental * (1 - clamp(resistance, -100, 75) / 100);
}

// ── Player swing ──

interface PlayerSwingArgs {
	swing: SwingProfile;
	stats: ComputedCharacterStats;
	defender: DefenderProfile;
	random?: () => number;
}

/**
 * Roll one player swing using the full damage formula. Returns the final
 * damage to apply to the defender plus a breakdown of how it landed.
 */
export function rollPlayerSwing({
	swing,
	stats,
	defender,
	random = Math.random,
}: PlayerSwingArgs): RolledSwing {
	const isAttack = stats.path === "attack";
	const isSpell = stats.path === "spell";

	// Spells bypass the accuracy/evasion gate entirely — they always land.
	// Attacks roll against the defender's evasion using the attacker's accuracy.
	if (!isSpell) {
		const hit = random() <= hitChance(stats.accuracy, defender.evasion);
		if (!hit) {
			return {
				amount: 0,
				isCrit: false,
				isMiss: true,
				isBlocked: false,
				breakdown: { physical: 0, cold: 0, fire: 0, lightning: 0, void: 0 },
			};
		}
	}

	// 1. Roll flat damage per type using the swing's base ranges.
	const physBase = randInt(swing.physicalDamage.min, swing.physicalDamage.max);
	const elementRolls: Record<string, number> = {
		Cold: 0,
		Fire: 0,
		Lightning: 0,
		Void: 0,
	};
	for (const e of swing.elementalDamage) {
		elementRolls[e.element] =
			(elementRolls[e.element] ?? 0) + randInt(e.min, e.max);
	}

	// 2. Sum increased pools per element, applied additively then once.
	const inc = stats.increased;
	const pathSpecific = isAttack ? inc.melee : isSpell ? inc.spell : 0;
	const physIncreased = inc.physical + pathSpecific;
	const elementBonus = (perElement: number) =>
		perElement +
		inc.elementalGlobal +
		(isAttack ? inc.elementalWithAttacks : 0) +
		pathSpecific;

	const phys = physBase * (1 + physIncreased / 100);
	let cold = elementRolls.Cold * (1 + elementBonus(inc.cold) / 100);
	let fire = elementRolls.Fire * (1 + elementBonus(inc.fire) / 100);
	let lightning =
		elementRolls.Lightning * (1 + elementBonus(inc.lightning) / 100);
	let voidDmg = elementRolls.Void * (1 + elementBonus(inc.void) / 100);

	// See CONTEXT.md → "Gain as Extra Elemental".
	if (isSpell) {
		const gain = stats.gainAsExtraSpell;
		if (gain.cold > 0 || gain.fire > 0 || gain.lightning > 0 || gain.void > 0) {
			const spellTotal = phys + cold + fire + lightning + voidDmg;
			cold += spellTotal * (gain.cold / 100);
			fire += spellTotal * (gain.fire / 100);
			lightning += spellTotal * (gain.lightning / 100);
			voidDmg += spellTotal * (gain.void / 100);
		}
	}

	// 3. Crit roll — use the swinging weapon's base crit + global multiplier.
	const finalCrit = clamp(
		swing.baseCritChance * (1 + inc.criticalChance / 100),
		CRIT_CHANCE_FLOOR,
		CRIT_CHANCE_CAP,
	);
	const isCrit = random() * 100 < finalCrit;
	const critMult = isCrit
		? 1 + (BASE_CRIT_MULTIPLIER + stats.bonusCritMultiplier) / 100
		: 1;

	// 4. Apply defender mitigation: armor for physical, resists per element.
	const physFinal = applyArmor(phys * critMult, defender.armor);
	const coldFinal = applyResistance(cold * critMult, defender.resistances.cold);
	const fireFinal = applyResistance(fire * critMult, defender.resistances.fire);
	const lightningFinal = applyResistance(
		lightning * critMult,
		defender.resistances.lightning,
	);
	const voidFinal = applyResistance(
		voidDmg * critMult,
		defender.resistances.void,
	);

	const breakdown: DamageBreakdown = {
		physical: Math.max(0, Math.floor(physFinal)),
		cold: Math.max(0, Math.floor(coldFinal)),
		fire: Math.max(0, Math.floor(fireFinal)),
		lightning: Math.max(0, Math.floor(lightningFinal)),
		void: Math.max(0, Math.floor(voidFinal)),
	};
	const total =
		breakdown.physical +
		breakdown.cold +
		breakdown.fire +
		breakdown.lightning +
		breakdown.void;

	return {
		amount: Math.max(1, total),
		isCrit,
		isMiss: false,
		isBlocked: false,
		breakdown,
	};
}

// ── Enemy attack ──

interface EnemyAttackArgs {
	// Pre-scaled by `scaleMonsterStats` (+ monster mods) at spawn — damage.ts
	// stays decoupled from MonsterDefinition and the scaling curve. `accuracy`
	// defaults to `level × 10` upstream; monster mods like Increased Accuracy
	// fold into this value.
	enemyAccuracy: number;
	physicalDamage: { min: number; max: number };
	elementalDamage: readonly MonsterElementDamage[];
	defender: DefenderProfile;
	// Crit chance % and multiplier % on the monster (post-mods). Default to
	// the baseline 5% / 50% if omitted so callers that haven't migrated yet
	// still get the floor behaviour (every monster carries a baseline crit).
	enemyCriticalChance?: number;
	enemyCriticalMultiplier?: number;
	random?: () => number;
}

/**
 * Roll one enemy attack. Mirrors `rollPlayerSwing`'s damage pipeline:
 * roll a flat amount per type (physical + each element on the template),
 * crit-roll against the monster's chance, mitigate physical via armor and
 * each element via its resistance, sum. Defender's evasion gates the hit
 * before any of the damage math runs.
 */
export function rollEnemyAttack({
	enemyAccuracy,
	physicalDamage,
	elementalDamage,
	defender,
	enemyCriticalChance = 5,
	enemyCriticalMultiplier = 50,
	random = Math.random,
}: EnemyAttackArgs): RolledSwing {
	const hit = random() <= hitChance(enemyAccuracy, defender.evasion);
	if (!hit) {
		return {
			amount: 0,
			isCrit: false,
			isMiss: true,
			isBlocked: false,
			breakdown: { physical: 0, cold: 0, fire: 0, lightning: 0, void: 0 },
		};
	}

	// Block roll — only the player carries a shield in MVP, so blockChance on
	// the defender profile is non-zero only when defending. A blocked hit lands
	// as a "hit" for the attacker's bookkeeping (per CONTEXT.md: triggers
	// thorns reflection, on-hit, etc) but deals zero damage.
	const blockChance = defender.blockChance ?? 0;
	if (blockChance > 0 && random() * 100 < blockChance) {
		return {
			amount: 0,
			isCrit: false,
			isMiss: false,
			isBlocked: true,
			breakdown: { physical: 0, cold: 0, fire: 0, lightning: 0, void: 0 },
		};
	}

	// No floor on the enemy side — the 5% baseline lives in
	// `scaleMonsterStats`, so a caller that explicitly passes 0 is opting
	// out of crit (e.g. tests, future "anti-crit" mob). Capped at 100% so
	// stacked crit-chance mods don't overflow.
	const finalCritChance = clamp(enemyCriticalChance, 0, CRIT_CHANCE_CAP);
	const isCrit = random() * 100 < finalCritChance;
	const critMult = isCrit ? 1 + enemyCriticalMultiplier / 100 : 1;

	const physRaw = randInt(
		Math.max(0, physicalDamage.min),
		Math.max(physicalDamage.min, physicalDamage.max),
	);
	const physFinal = applyArmor(physRaw * critMult, defender.armor);

	const elementRolls: Record<"Cold" | "Fire" | "Lightning" | "Void", number> = {
		Cold: 0,
		Fire: 0,
		Lightning: 0,
		Void: 0,
	};
	for (const e of elementalDamage) {
		elementRolls[e.element] += randInt(
			Math.max(0, e.min),
			Math.max(e.min, e.max),
		);
	}
	const coldFinal = applyResistance(
		elementRolls.Cold * critMult,
		defender.resistances.cold,
	);
	const fireFinal = applyResistance(
		elementRolls.Fire * critMult,
		defender.resistances.fire,
	);
	const lightningFinal = applyResistance(
		elementRolls.Lightning * critMult,
		defender.resistances.lightning,
	);
	const voidFinal = applyResistance(
		elementRolls.Void * critMult,
		defender.resistances.void,
	);

	const breakdown: DamageBreakdown = {
		physical: Math.max(0, Math.floor(physFinal)),
		cold: Math.max(0, Math.floor(coldFinal)),
		fire: Math.max(0, Math.floor(fireFinal)),
		lightning: Math.max(0, Math.floor(lightningFinal)),
		void: Math.max(0, Math.floor(voidFinal)),
	};
	const total =
		breakdown.physical +
		breakdown.cold +
		breakdown.fire +
		breakdown.lightning +
		breakdown.void;

	return {
		amount: Math.max(1, total),
		isCrit,
		isMiss: false,
		isBlocked: false,
		breakdown,
	};
}

// ── Barrier / Life split ──

export interface DamageApplyResult {
	newBarrier: number;
	newLife: number;
	barrierAbsorbed: number;
	lifeLost: number;
	barrierJustEmptied: boolean;
}

export function applyDamageToBarrierThenLife(
	damage: number,
	currentBarrier: number,
	currentLife: number,
): DamageApplyResult {
	if (damage <= 0) {
		return {
			newBarrier: currentBarrier,
			newLife: currentLife,
			barrierAbsorbed: 0,
			lifeLost: 0,
			barrierJustEmptied: false,
		};
	}
	const barrierAbsorbed = Math.min(currentBarrier, damage);
	const remaining = damage - barrierAbsorbed;
	const newBarrier = currentBarrier - barrierAbsorbed;
	const newLife = Math.max(0, currentLife - remaining);
	return {
		newBarrier,
		newLife,
		barrierAbsorbed,
		lifeLost: currentLife - newLife,
		barrierJustEmptied: currentBarrier > 0 && newBarrier === 0,
	};
}
