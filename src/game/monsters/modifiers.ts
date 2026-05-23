import { type ScaledMonsterStats, scaleRange } from "./scaling";
import type { MonsterRarity } from "./types";

// Pool of monster modifiers that decorate magic and rare spawns. See
// CONTEXT.md → Monster Modifier Pool. Magnitudes are fixed (no per-roll
// range); variance comes from WHICH mods land.
//
// Each mod is tagged prefix | suffix so the localized name can render
// PoE-style ("Tough Goblin of Swiftness"). The roller caps at 2 of each
// affix per spawn so a 3-mod rare always mixes prefix + suffix.

// Per-level magnitudes for the defensive flats. Exported so the tooltip
// renderer reads the same constants and can't drift from the apply()s.
// The numbers are calibrated against act 1 (lvl ~17 ceiling): +30/lvl
// evasion / accuracy ≈ +510 at the end of the act, +15/lvl armor ≈ +255.
export const MONSTER_EVASION_PER_LEVEL = 30;
export const MONSTER_ACCURACY_PER_LEVEL = 30;
export const MONSTER_ARMOR_PER_LEVEL = 15;

export type MonsterModAffixType = "prefix" | "suffix";

export interface MonsterModifier {
	id: string;
	affixType: MonsterModAffixType;
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
	// Defensive flats scale with monster level via the *_PER_LEVEL constants
	// above so they're not lopsided at low area level. Tooltip strings read
	// the same constants — keep both sides in lockstep.
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
		// Placeholder: HP × 1.3. Real barrier pool comes in the next PR — see
		// docs/plans/in-progress.md → Native monster barrier.
		id: "monsterAdditionalBarrier",
		affixType: "prefix",
		apply: (s) => ({ ...s, hp: Math.round(s.hp * 1.3) }),
	},
	monsterMoreArmor: {
		id: "monsterMoreArmor",
		affixType: "prefix",
		apply: (s) => ({
			...s,
			armor: s.armor + MONSTER_ARMOR_PER_LEVEL * s.level,
		}),
	},
} as const satisfies Record<string, MonsterModifier>;

export type MonsterModId = keyof typeof MONSTER_MODIFIERS;

const ALL_MONSTER_MOD_IDS = Object.keys(MONSTER_MODIFIERS) as MonsterModId[];

const MAGIC_SPAWN_CHANCE = 0.1;

// Affix cap per spawn. Forces a 3-mod rare to mix prefix + suffix instead of
// stacking three prefixes ("Storm-Hardened Swift Fire-Hardened Goblin").
const AFFIX_CAP = 2;

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
	const target = Math.min(count, pool.length);
	let prefixCount = 0;
	let suffixCount = 0;
	while (picked.length < target && pool.length > 0) {
		// Restrict eligibility once an affix hits its cap — the other affix is
		// still drawable until the pool runs dry.
		const eligible = pool.filter((id) => {
			const affix = MONSTER_MODIFIERS[id].affixType;
			return affix === "prefix"
				? prefixCount < AFFIX_CAP
				: suffixCount < AFFIX_CAP;
		});
		if (eligible.length === 0) break;
		const idx = Math.floor(random() * eligible.length);
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
	let out = scaled;
	for (const id of modIds) {
		out = MONSTER_MODIFIERS[id].apply(out);
	}
	return out;
}
