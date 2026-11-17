import { defaultRng, type Rng } from "#/lib/rng";

import { typedKeys } from "../typed-object";
import { type ScaledMonsterStats, scaleRange } from "./scaling";
import type { MonsterRarity } from "./types";

export const MONSTER_EVASION_PER_LEVEL = 30;
export const MONSTER_ACCURACY_PER_LEVEL = 30;
export const MONSTER_ARMOR_PER_LEVEL = 15;

export const MONSTER_CRIT_CHANCE_INCREASE_PCT = 150;
export const MONSTER_CRIT_MULTIPLIER_PCT = 50;

export const MONSTER_ELEMENTAL_DAMAGE_PCT = 30;

export const MONSTER_BARRIER_HP_FRACTION = 0.3;

export type MonsterModAffixType = "prefix" | "suffix";

export interface MonsterModifier {
	id: string;
	affixType: MonsterModAffixType;
	order?: "normal" | "trailing";
	apply(stats: ScaledMonsterStats): ScaledMonsterStats;
}

function scaleDamage(
	stats: ScaledMonsterStats,
	factor: number,
): ScaledMonsterStats {
	return {
		...stats,
		physicalDamage: scaleRange(stats.physicalDamage, factor),
		elementalDamage: stats.elementalDamage.map((e) => ({
			element: e.element,
			...scaleRange({ min: e.min, max: e.max }, factor),
		})),
	};
}

export const MONSTER_MODIFIERS = {
	monsterIncreasedLife: {
		id: "monsterIncreasedLife",
		affixType: "prefix",
		apply: (s) => ({ ...s, hp: Math.round(s.hp * 1.5) }),
	},
	monsterIncreasedDamage: {
		id: "monsterIncreasedDamage",
		affixType: "prefix",
		apply: (s) => scaleDamage(s, 1.4),
	},
	monsterIncreasedAttackSpeed: {
		id: "monsterIncreasedAttackSpeed",
		affixType: "suffix",
		apply: (s) => ({ ...s, attackSpeed: s.attackSpeed * 1.3 }),
	},
	monsterIncreasedEvasion: {
		id: "monsterIncreasedEvasion",
		affixType: "prefix",
		apply: (s) => ({
			...s,
			evasion: s.evasion + MONSTER_EVASION_PER_LEVEL * s.level,
		}),
	},
	monsterIncreasedAccuracy: {
		id: "monsterIncreasedAccuracy",
		affixType: "suffix",
		apply: (s) => ({
			...s,
			accuracy: s.accuracy + MONSTER_ACCURACY_PER_LEVEL * s.level,
		}),
	},
	monsterColdResistance: {
		id: "monsterColdResistance",
		affixType: "suffix",
		apply: (s) => ({
			...s,
			resistances: { ...s.resistances, cold: s.resistances.cold + 50 },
		}),
	},
	monsterFireResistance: {
		id: "monsterFireResistance",
		affixType: "suffix",
		apply: (s) => ({
			...s,
			resistances: { ...s.resistances, fire: s.resistances.fire + 50 },
		}),
	},
	monsterLightningResistance: {
		id: "monsterLightningResistance",
		affixType: "suffix",
		apply: (s) => ({
			...s,
			resistances: {
				...s.resistances,
				lightning: s.resistances.lightning + 50,
			},
		}),
	},
	monsterVoidResistance: {
		id: "monsterVoidResistance",
		affixType: "suffix",
		apply: (s) => ({
			...s,
			resistances: { ...s.resistances, void: s.resistances.void + 50 },
		}),
	},
	monsterAdditionalBarrier: {
		id: "monsterAdditionalBarrier",
		affixType: "prefix",
		order: "trailing",
		apply: (s) => ({
			...s,
			barrier: Math.max(1, Math.round(s.hp * MONSTER_BARRIER_HP_FRACTION)),
		}),
	},
	monsterMoreArmor: {
		id: "monsterMoreArmor",
		affixType: "prefix",
		apply: (s) => ({
			...s,
			armor: s.armor + MONSTER_ARMOR_PER_LEVEL * s.level,
		}),
	},
	monsterCriticalChanceIncrease: {
		id: "monsterCriticalChanceIncrease",
		affixType: "prefix",
		apply: (s) => ({
			...s,
			criticalChance:
				s.criticalChance * (1 + MONSTER_CRIT_CHANCE_INCREASE_PCT / 100),
		}),
	},
	monsterCriticalMultiplier: {
		id: "monsterCriticalMultiplier",
		affixType: "suffix",
		apply: (s) => ({
			...s,
			criticalMultiplier: s.criticalMultiplier + MONSTER_CRIT_MULTIPLIER_PCT,
		}),
	},
	monsterColdDamage: {
		id: "monsterColdDamage",
		affixType: "prefix",
		apply: (s) => ({
			...s,
			gainAsExtraDamage: {
				...s.gainAsExtraDamage,
				cold: s.gainAsExtraDamage.cold + MONSTER_ELEMENTAL_DAMAGE_PCT,
			},
		}),
	},
	monsterFireDamage: {
		id: "monsterFireDamage",
		affixType: "prefix",
		apply: (s) => ({
			...s,
			gainAsExtraDamage: {
				...s.gainAsExtraDamage,
				fire: s.gainAsExtraDamage.fire + MONSTER_ELEMENTAL_DAMAGE_PCT,
			},
		}),
	},
	monsterLightningDamage: {
		id: "monsterLightningDamage",
		affixType: "prefix",
		apply: (s) => ({
			...s,
			gainAsExtraDamage: {
				...s.gainAsExtraDamage,
				lightning: s.gainAsExtraDamage.lightning + MONSTER_ELEMENTAL_DAMAGE_PCT,
			},
		}),
	},
	monsterVoidDamage: {
		id: "monsterVoidDamage",
		affixType: "prefix",
		apply: (s) => ({
			...s,
			gainAsExtraDamage: {
				...s.gainAsExtraDamage,
				void: s.gainAsExtraDamage.void + MONSTER_ELEMENTAL_DAMAGE_PCT,
			},
		}),
	},
} as const satisfies Record<string, MonsterModifier>;

export type MonsterModId = keyof typeof MONSTER_MODIFIERS;

const ALL_MONSTER_MOD_IDS: readonly MonsterModId[] =
	typedKeys(MONSTER_MODIFIERS);

const MAGIC_SPAWN_CHANCE = 0.1;

const AFFIX_CAP = 2;

export function rollMonsterRarity(rng: Rng = defaultRng): MonsterRarity {
	return rng.unit() < MAGIC_SPAWN_CHANCE ? "magic" : "normal";
}

export function modCountForRarity(rarity: MonsterRarity): number {
	switch (rarity) {
		case "normal":
			return 0;
		case "magic":
			return 1;
		case "rare":
			return 4;
		case "unique":
			return 0;
	}
}

export function rollMonsterMods(
	count: number,
	rng: Rng = defaultRng,
): MonsterModId[] {
	if (count <= 0) return [];
	const pool = [...ALL_MONSTER_MOD_IDS];
	const picked: MonsterModId[] = [];
	const target = Math.min(count, pool.length);
	let prefixCount = 0;
	let suffixCount = 0;
	while (picked.length < target && pool.length > 0) {
		const prefixOpen = prefixCount < AFFIX_CAP;
		const suffixOpen = suffixCount < AFFIX_CAP;
		const eligible = pool.filter((id) =>
			MONSTER_MODIFIERS[id].affixType === "prefix" ? prefixOpen : suffixOpen,
		);
		if (eligible.length === 0) break;
		const idx = Math.floor(rng.unit() * eligible.length);
		const id = eligible[idx];
		picked.push(id);
		if (MONSTER_MODIFIERS[id].affixType === "prefix") prefixCount += 1;
		else suffixCount += 1;
		pool.splice(pool.indexOf(id), 1);
	}
	return picked;
}

export function applyMonsterMods(
	scaled: ScaledMonsterStats,
	modIds: readonly MonsterModId[],
): ScaledMonsterStats {
	const isTrailing = (id: MonsterModId): boolean => {
		const def: MonsterModifier = MONSTER_MODIFIERS[id];
		return def.order === "trailing";
	};
	let out = scaled;
	for (const id of modIds) {
		if (!isTrailing(id)) out = MONSTER_MODIFIERS[id].apply(out);
	}
	for (const id of modIds) {
		if (isTrailing(id)) out = MONSTER_MODIFIERS[id].apply(out);
	}
	return out;
}
