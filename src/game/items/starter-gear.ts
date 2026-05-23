import type { CharacterClassId } from "../classes/types";
import type { GeneratedItem } from "./types";

// ── Starter weapons ──
// Fixed, hand-authored items that classes start equipped with. They do not pass
// through the random generator. IDs are namespaced with the "starter:" prefix
// so equipped-item references can distinguish them from rolled items later.

// Starter weapons sit one step below the T1 dropped equivalents — the player
// is meant to feel a clear upgrade the moment any T1 drops, and the early
// pacing aims for ~5 hits/kill in forest_starter vs ~4 hits/kill once the
// first T1 weapon lands.

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
		minDamage: 2,
		maxDamage: 6,
		attackSpeed: 1.5,
		criticalChance: 5,
	},
	implicits: [],
	explicits: [],
	computedStats: {
		physicalDamage: { min: 2, max: 6 },
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
		minDamage: 2,
		maxDamage: 4,
		attackSpeed: 1.7,
		criticalChance: 6.5,
	},
	implicits: [],
	explicits: [],
	computedStats: {
		physicalDamage: { min: 2, max: 4 },
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
		minDamage: 2,
		maxDamage: 5,
		attackSpeed: 1.4,
		criticalChance: 7,
	},
	implicits: [],
	explicits: [],
	computedStats: {
		physicalDamage: { min: 2, max: 5 },
		elementalDamage: [],
		attackSpeed: 1.4,
		criticalChance: 7,
	},
};

const STARTER_ITEMS: Record<string, GeneratedItem> = {
	"starter:rusty_sword": rustySword,
	"starter:rusty_dagger": rustyDagger,
	"starter:cracked_wand": crackedWand,
};

export const STARTER_WEAPON_BY_CLASS: Record<CharacterClassId, string> = {
	warrior: "starter:rusty_sword",
	rogue: "starter:rusty_dagger",
	mage: "starter:cracked_wand",
};

/**
 * Resolve a starter-item id (e.g., "starter:rusty_sword") to its definition.
 * Returns null for unknown ids (including generated-item ids, which use a
 * different prefix).
 */
export function findStarterItem(id: string): GeneratedItem | null {
	return STARTER_ITEMS[id] ?? null;
}
