import { type ScaledMonsterStats, scaleRange } from "./scaling";
import type { MonsterRarity } from "./types";

// Pool of monster modifiers that decorate magic and rare spawns. See
// CONTEXT.md → Monster Modifier Pool. Magnitudes are fixed (no per-roll
// range); variance comes from WHICH mods land.

export interface MonsterModifier {
	id: string;
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
		apply: (s) => ({ ...s, hp: Math.round(s.hp * 1.5) }),
	},
	monsterIncreasedDamage: {
		id: "monsterIncreasedDamage",
		apply: (s) => scaleDamage(s, 1.4),
	},
	monsterIncreasedAttackSpeed: {
		id: "monsterIncreasedAttackSpeed",
		apply: (s) => ({ ...s, attackSpeed: s.attackSpeed * 1.3 }),
	},
	monsterIncreasedEvasion: {
		id: "monsterIncreasedEvasion",
		apply: (s) => ({ ...s, evasion: s.evasion + 500 }),
	},
	monsterIncreasedAccuracy: {
		id: "monsterIncreasedAccuracy",
		apply: (s) => ({ ...s, accuracy: s.accuracy + 500 }),
	},
	monsterColdResistance: {
		id: "monsterColdResistance",
		apply: (s) => ({
			...s,
			resistances: { ...s.resistances, cold: s.resistances.cold + 50 },
		}),
	},
	monsterFireResistance: {
		id: "monsterFireResistance",
		apply: (s) => ({
			...s,
			resistances: { ...s.resistances, fire: s.resistances.fire + 50 },
		}),
	},
	monsterLightningResistance: {
		id: "monsterLightningResistance",
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
		apply: (s) => ({
			...s,
			resistances: { ...s.resistances, void: s.resistances.void + 50 },
		}),
	},
	monsterAdditionalBarrier: {
		// Placeholder: HP × 1.3. Real barrier pool comes in the next PR — see
		// docs/plans/in-progress.md → Native monster barrier.
		id: "monsterAdditionalBarrier",
		apply: (s) => ({ ...s, hp: Math.round(s.hp * 1.3) }),
	},
	monsterMoreArmor: {
		id: "monsterMoreArmor",
		apply: (s) => ({ ...s, armor: s.armor + 200 }),
	},
} as const satisfies Record<string, MonsterModifier>;

export type MonsterModId = keyof typeof MONSTER_MODIFIERS;

const ALL_MONSTER_MOD_IDS = Object.keys(MONSTER_MODIFIERS) as MonsterModId[];

const MAGIC_SPAWN_CHANCE = 0.1;

export function rollMonsterRarity(
	random: () => number = Math.random,
): MonsterRarity {
	return random() < MAGIC_SPAWN_CHANCE ? "magic" : "normal";
}

export function modCountForRarity(rarity: MonsterRarity): number {
	switch (rarity) {
		case "normal":
			return 0;
		case "magic":
			return 1;
		case "rare":
			return 3;
	}
}

export function rollMonsterMods(
	count: number,
	random: () => number = Math.random,
): MonsterModId[] {
	if (count <= 0) return [];
	const pool = [...ALL_MONSTER_MOD_IDS];
	const picked: MonsterModId[] = [];
	const take = Math.min(count, pool.length);
	for (let i = 0; i < take; i++) {
		const idx = Math.floor(random() * pool.length);
		picked.push(pool[idx]);
		pool.splice(idx, 1);
	}
	return picked;
}

export function applyMonsterMods(
	scaled: ScaledMonsterStats,
	modIds: readonly MonsterModId[],
): ScaledMonsterStats {
	let out = scaled;
	for (const id of modIds) {
		out = MONSTER_MODIFIERS[id].apply(out);
	}
	return out;
}
