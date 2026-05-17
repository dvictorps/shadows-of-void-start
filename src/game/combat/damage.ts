import { randInt } from "#/lib/rng";
import type { GeneratedItem } from "../items/types";
import type { MonsterDefinition } from "../monsters/types";

const CRIT_MULTIPLIER = 1.5;

export interface DamageResult {
	amount: number;
	isCrit: boolean;
}

/**
 * Rolls a single player attack against current gear. Reads physical damage,
 * crit chance, and applies the global crit multiplier. Damage floor is 1.
 */
export function rollPlayerDamage(weapon: GeneratedItem | null): DamageResult {
	const phys = weapon?.computedStats?.physicalDamage ?? { min: 1, max: 1 };
	const min = Math.max(1, phys.min);
	const max = Math.max(min, phys.max);
	const base = randInt(min, max);
	const critPct = weapon?.computedStats?.criticalChance ?? 0;
	const isCrit = Math.random() * 100 < critPct;
	const amount = isCrit ? Math.floor(base * CRIT_MULTIPLIER) : base;
	return { amount: Math.max(1, amount), isCrit };
}

/**
 * Rolls a single enemy attack from a monster's base stats. No crit yet —
 * minibosses with offensive modifiers can layer that on later.
 */
export function rollEnemyDamage(def: MonsterDefinition): number {
	const { minDamage, maxDamage } = def.baseStats;
	const min = Math.max(0, minDamage);
	const max = Math.max(min, maxDamage);
	return randInt(min, max);
}
