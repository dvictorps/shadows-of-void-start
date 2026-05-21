import type { MonsterDefinition, MonsterElementDamage } from "./types";

// Geometric scaling factor matches PoE/Last Epoch's approach: player power
// grows multiplicatively via gear, so monsters must too. See CONTEXT.md →
// "Monster stat scaling" for the rationale and the rejected linear alternative.
export const MONSTER_SCALING_BASE = 1.06;

export interface ScaledMonsterStats {
	hp: number;
	physicalDamage: { min: number; max: number };
	elementalDamage: MonsterElementDamage[];
	attackSpeed: number;
	xpReward: number;
}

export function monsterScaleFactor(level: number): number {
	const clamped = Math.max(1, level);
	return MONSTER_SCALING_BASE ** (clamped - 1);
}

function scaleRange(
	range: { min: number; max: number },
	factor: number,
): { min: number; max: number } {
	const min = Math.max(0, Math.round(range.min * factor));
	const max = Math.max(min, Math.round(range.max * factor));
	return { min, max };
}

export function scaleMonsterStats(
	def: MonsterDefinition,
	level: number,
): ScaledMonsterStats {
	const factor = monsterScaleFactor(level);
	return {
		hp: Math.max(1, Math.round(def.baseStats.hp * factor)),
		physicalDamage: scaleRange(def.baseStats.physicalDamage, factor),
		elementalDamage: def.baseStats.elementalDamage.map((e) => {
			const { min, max } = scaleRange({ min: e.min, max: e.max }, factor);
			return { element: e.element, min, max };
		}),
		attackSpeed: def.baseStats.attackSpeed,
		xpReward: Math.max(1, Math.round(def.xpReward * factor)),
	};
}
