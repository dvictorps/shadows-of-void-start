import type { CharacterClassId } from "../classes/types";
import type { GeneratedItem } from "./types";

// ── Starter weapons ──
// Fixed, hand-authored items that classes start equipped with. They do not pass
// through the random generator. IDs are namespaced with the "starter:" prefix
// so equipped-item references can distinguish them from rolled items later.

// Starter weapons sit slightly ABOVE T1 dropped equivalents (sword 4-9 vs
// T1 3-7, dagger 5-8 vs T1 2-5, wand 4-8 vs T1 2-6). The original
// "starters below T1" design was overcorrected — fresh lvl 1 characters
// have no gear, no mods, no implicit accuracy/crit on the starter, and the
// forest_starter pacing felt punishing. The starter buff plus the lvl 1-4
// monster damage cliff together rebuild early-game footing. The bigger
// upgrade incentive over starters is now the T1+ implicit (accuracy /
// crit multi / spell damage) and the first rolled mods, not the base
// damage gap.

const rustySword: GeneratedItem = {
	id: "starter:rusty_sword",
	templateId: "rusty_sword",
	nameBase: "sword",
	nameModifier: "rusty",
	equipmentType: "weapon",
	weaponType: "sword",
	rarity: "normal",
	itemLevel: 1,
	icon: "/assets/sprites/armas/pesadas/espadaCurta.png",
	baseStats: {
		minDamage: 4,
		maxDamage: 9,
		attackSpeed: 1.5,
		criticalChance: 5,
	},
	implicits: [],
	explicits: [],
	computedStats: {
		physicalDamage: { min: 4, max: 9 },
		elementalDamage: [],
		attackSpeed: 1.5,
		criticalChance: 5,
	},
};

const rustyDagger: GeneratedItem = {
	id: "starter:rusty_dagger",
	templateId: "rusty_dagger",
	nameBase: "dagger",
	nameModifier: "rusty",
	equipmentType: "weapon",
	weaponType: "dagger",
	rarity: "normal",
	itemLevel: 1,
	// No icon: daggers have no sprite assets in `public/assets/sprites/armas/`
	// at the moment (gap also affects all dropped dagger tiers). Falls back to
	// the emoji override. Add a sprite + populate this field when art lands.
	baseStats: {
		minDamage: 5,
		maxDamage: 8,
		attackSpeed: 1.7,
		criticalChance: 6.5,
	},
	implicits: [],
	explicits: [],
	computedStats: {
		physicalDamage: { min: 5, max: 8 },
		elementalDamage: [],
		attackSpeed: 1.7,
		criticalChance: 6.5,
	},
};

const crackedWand: GeneratedItem = {
	id: "starter:cracked_wand",
	templateId: "cracked_wand",
	nameBase: "wand",
	nameModifier: "cracked",
	equipmentType: "weapon",
	weaponType: "wand",
	rarity: "normal",
	itemLevel: 1,
	icon: "/assets/sprites/armas/caster/varinha.png",
	baseStats: {
		minDamage: 4,
		maxDamage: 8,
		attackSpeed: 1.4,
		criticalChance: 7,
	},
	implicits: [],
	explicits: [],
	computedStats: {
		physicalDamage: { min: 4, max: 8 },
		elementalDamage: [],
		attackSpeed: 1.4,
		criticalChance: 7,
	},
};

// Rogue starter chestplate. Mirrors leather_chestplate_t1 (evasion 20) so the
// fresh rogue has a non-zero defensive layer matching warrior's HP and mage's
// barrier-from-class.
const tatteredLeatherVest: GeneratedItem = {
	id: "starter:tattered_leather_vest",
	templateId: "leather_chestplate_t1",
	nameBase: "vest",
	nameModifier: "tattered",
	equipmentType: "chestplate",
	armorType: "leather",
	rarity: "normal",
	itemLevel: 1,
	icon: "/assets/sprites/armaduras/evasao/armaduraEvasao1.png",
	baseStats: { evasion: 20 },
	implicits: [],
	explicits: [],
	computedDefenseStats: { evasion: 20 },
};

const STARTER_ITEMS: Record<string, GeneratedItem> = {
	"starter:rusty_sword": rustySword,
	"starter:rusty_dagger": rustyDagger,
	"starter:cracked_wand": crackedWand,
	"starter:tattered_leather_vest": tatteredLeatherVest,
};

export const STARTER_WEAPON_BY_CLASS: Record<CharacterClassId, string> = {
	warrior: "starter:rusty_sword",
	rogue: "starter:rusty_dagger",
	mage: "starter:cracked_wand",
};

// Per-class starter armor — currently only rogues get one (warriors have HP
// and mages have barrier from their class; rogues' evasion identity needs a
// piece of leather to activate). Empty entries mean "no starter armor".
export const STARTER_CHESTPLATE_BY_CLASS: Partial<
	Record<CharacterClassId, string>
> = {
	rogue: "starter:tattered_leather_vest",
};

/**
 * Resolve a starter-item id (e.g., "starter:rusty_sword") to its definition.
 * Returns null for unknown ids (including generated-item ids, which use a
 * different prefix).
 */
export function findStarterItem(id: string): GeneratedItem | null {
	return STARTER_ITEMS[id] ?? null;
}
