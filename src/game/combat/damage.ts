import { defaultRng, randInt, type Rng } from "../../lib/rng";
import type { MonsterElementDamage } from "../monsters/types";
import type { ComputedCharacterStats, SwingProfile } from "../stats/types";
import {
	BASE_CRIT_MULTIPLIER,
	CRIT_CHANCE_CAP,
	CRIT_CHANCE_FLOOR,
} from "./constants";

const HIT_CHANCE_MIN = 0.05;
const HIT_CHANCE_MAX = 0.95;
const ARMOR_REDUCTION_CAP = 0.85;

export interface ElementalGainPct {
	cold: number;
	fire: number;
	lightning: number;
	void: number;
}

export const EMPTY_ELEMENTAL_GAIN: ElementalGainPct = {
	cold: 0,
	fire: 0,
	lightning: 0,
	void: 0,
};

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

function clamp(n: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, n));
}

function hitChance(attackerAcc: number, defenderEva: number): number {
	if (attackerAcc <= 0 && defenderEva <= 0) return HIT_CHANCE_MAX;
	const raw = attackerAcc / (attackerAcc + defenderEva / 4);
	return clamp(raw, HIT_CHANCE_MIN, HIT_CHANCE_MAX);
}

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

interface PlayerSwingArgs {
	swing: SwingProfile;
	stats: ComputedCharacterStats;
	defender: DefenderProfile;
	rng?: Rng;
}

export function rollPlayerSwing({
	swing,
	stats,
	defender,
	rng = defaultRng,
}: PlayerSwingArgs): RolledSwing {
	const isAttack = stats.path === "attack";
	const isSpell = stats.path === "spell";

	if (!isSpell) {
		const hit = rng.unit() <= hitChance(stats.accuracy, defender.evasion);
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

	const physBase = randInt(
		swing.physicalDamage.min,
		swing.physicalDamage.max,
		rng,
	);
	const elementRolls = new Map<string, number>();
	for (const e of swing.elementalDamage) {
		elementRolls.set(
			e.element,
			(elementRolls.get(e.element) ?? 0) + randInt(e.min, e.max, rng),
		);
	}
	const rolled = (element: string) => elementRolls.get(element) ?? 0;

	const inc = stats.increased;
	const pathSpecific = isAttack ? inc.melee : isSpell ? inc.spell : 0;
	const physIncreased = inc.physical + pathSpecific;
	const elementBonus = (perElement: number) =>
		perElement +
		inc.elementalGlobal +
		(isAttack ? inc.elementalWithAttacks : 0) +
		pathSpecific;

	const phys = physBase * (1 + physIncreased / 100);
	let cold = rolled("Cold") * (1 + elementBonus(inc.cold) / 100);
	let fire = rolled("Fire") * (1 + elementBonus(inc.fire) / 100);
	let lightning = rolled("Lightning") * (1 + elementBonus(inc.lightning) / 100);
	let voidDmg = rolled("Void") * (1 + elementBonus(inc.void) / 100);

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

	const finalCrit = clamp(
		swing.baseCritChance * (1 + inc.criticalChance / 100),
		CRIT_CHANCE_FLOOR,
		CRIT_CHANCE_CAP,
	);
	const isCrit = rng.unit() * 100 < finalCrit;
	const critMult = isCrit
		? 1 + (BASE_CRIT_MULTIPLIER + stats.bonusCritMultiplier) / 100
		: 1;

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

interface EnemyAttackArgs {
	enemyAccuracy: number;
	physicalDamage: { min: number; max: number };
	elementalDamage: readonly MonsterElementDamage[];
	defender: DefenderProfile;
	enemyCriticalChance?: number;
	enemyCriticalMultiplier?: number;
	enemyGainAsExtra?: ElementalGainPct;
	rng?: Rng;
}

export function rollEnemyAttack({
	enemyAccuracy,
	physicalDamage,
	elementalDamage,
	defender,
	enemyCriticalChance = 5,
	enemyCriticalMultiplier = 50,
	enemyGainAsExtra,
	rng = defaultRng,
}: EnemyAttackArgs): RolledSwing {
	const hit = rng.unit() <= hitChance(enemyAccuracy, defender.evasion);
	if (!hit) {
		return {
			amount: 0,
			isCrit: false,
			isMiss: true,
			isBlocked: false,
			breakdown: { physical: 0, cold: 0, fire: 0, lightning: 0, void: 0 },
		};
	}

	const blockChance = defender.blockChance ?? 0;
	if (blockChance > 0 && rng.unit() * 100 < blockChance) {
		return {
			amount: 0,
			isCrit: false,
			isMiss: false,
			isBlocked: true,
			breakdown: { physical: 0, cold: 0, fire: 0, lightning: 0, void: 0 },
		};
	}

	const physRaw = randInt(
		Math.max(0, physicalDamage.min),
		Math.max(physicalDamage.min, physicalDamage.max),
		rng,
	);
	const elementRolls = {
		Cold: 0,
		Fire: 0,
		Lightning: 0,
		Void: 0,
	} satisfies Record<"Cold" | "Fire" | "Lightning" | "Void", number>;
	for (const e of elementalDamage) {
		elementRolls[e.element] += randInt(
			Math.max(0, e.min),
			Math.max(e.min, e.max),
			rng,
		);
	}

	if (
		enemyGainAsExtra &&
		(enemyGainAsExtra.cold > 0 ||
			enemyGainAsExtra.fire > 0 ||
			enemyGainAsExtra.lightning > 0 ||
			enemyGainAsExtra.void > 0)
	) {
		const total =
			physRaw +
			elementRolls.Cold +
			elementRolls.Fire +
			elementRolls.Lightning +
			elementRolls.Void;
		elementRolls.Cold += total * (enemyGainAsExtra.cold / 100);
		elementRolls.Fire += total * (enemyGainAsExtra.fire / 100);
		elementRolls.Lightning += total * (enemyGainAsExtra.lightning / 100);
		elementRolls.Void += total * (enemyGainAsExtra.void / 100);
	}

	const finalCritChance = clamp(enemyCriticalChance, 0, CRIT_CHANCE_CAP);
	const isCrit = rng.unit() * 100 < finalCritChance;
	const critMult = isCrit ? 1 + enemyCriticalMultiplier / 100 : 1;

	const physFinal = applyArmor(physRaw * critMult, defender.armor);
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
