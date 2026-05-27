import { BASE_CRIT_MULTIPLIER, CRIT_CHANCE_FLOOR } from "../combat/constants";
import { type ElementalGainPct, EMPTY_ELEMENTAL_GAIN } from "../combat/damage";
import type { MonsterDefinition, MonsterElementDamage } from "./types";

// Geometric scaling factor matches PoE/Last Epoch's approach: player power
// grows multiplicatively via gear, so monsters must too. See CONTEXT.md →
// "Monster stat scaling" for the rationale and the rejected linear alternative.
export const MONSTER_SCALING_BASE = 1.06;

export interface ScaledMonsterStats {
	// Resolved monster level. Carried through so modifiers can scale their
	// magnitudes against it — a +500 evasion mod at level 1 is impossible to
	// hit; per-level scaling keeps the curve sane across act 1.
	level: number;
	hp: number;
	physicalDamage: { min: number; max: number };
	elementalDamage: MonsterElementDamage[];
	attackSpeed: number;
	xpReward: number;
	// Defensive baseline. `accuracy` defaults to `level × 10` (CONTEXT.md →
	// Defenses → Evasion + Accuracy). Other defaults are 0. Monster modifiers
	// add to these at spawn time.
	armor: number;
	evasion: number;
	accuracy: number;
	resistances: { cold: number; fire: number; lightning: number; void: number };
	// Barrier pool above HP, mirrors the player's barrier. Defaults to 0 —
	// only the monsterAdditionalBarrier mod grants it. See CONTEXT.md →
	// Defenses → Barrier.
	barrier: number;
	// Crit chance % and crit multiplier %. Every monster ships with the same
	// 5% / 50% baseline as the player's floor; mods stack on top. See
	// CONTEXT.md → Combat Resolution → Damage formula.
	criticalChance: number;
	criticalMultiplier: number;
	// Per-element "gain X% of total damage as extra <element>", applied at
	// hit time before crit + mitigation. Mirrors the player's
	// `gainAsExtraSpell` (tome mod family). Defaults to all zeros — the
	// monsterXxxDamage mods stack additively here.
	gainAsExtraDamage: ElementalGainPct;
}

export function monsterScaleFactor(level: number): number {
	const clamped = Math.max(1, level);
	return MONSTER_SCALING_BASE ** (clamped - 1);
}

export function scaleRange(
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
	const clampedLevel = Math.max(1, level);
	const declared = def.baseStats.resistances;
	return {
		level: clampedLevel,
		hp: Math.max(1, Math.round(def.baseStats.hp * factor)),
		physicalDamage: scaleRange(def.baseStats.physicalDamage, factor),
		elementalDamage: def.baseStats.elementalDamage.map((e) => {
			const { min, max } = scaleRange({ min: e.min, max: e.max }, factor);
			return { element: e.element, min, max };
		}),
		attackSpeed: def.baseStats.attackSpeed,
		xpReward: Math.max(1, Math.round(def.xpReward * factor)),
		armor: 0,
		evasion: 0,
		accuracy: clampedLevel * 15,
		resistances: {
			cold: declared?.cold ?? 0,
			fire: declared?.fire ?? 0,
			lightning: declared?.lightning ?? 0,
			void: declared?.void ?? 0,
		},
		barrier: 0,
		criticalChance: CRIT_CHANCE_FLOOR,
		criticalMultiplier: BASE_CRIT_MULTIPLIER,
		// Fresh copy of the empty literal — mods apply via spread, so callers
		// would otherwise share the same constant across all spawns.
		gainAsExtraDamage: { ...EMPTY_ELEMENTAL_GAIN },
	};
}
