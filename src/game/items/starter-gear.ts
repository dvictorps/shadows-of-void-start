import type { CharacterClassId } from "../classes/types";
import type { GeneratedItem } from "./types";

// ── Starter weapons ──
// Fixed, hand-authored items that classes start equipped with. They do not pass
// through the random generator. IDs are namespaced with the "starter:" prefix
// so equipped-item references can distinguish them from rolled items later.

const rustySword: GeneratedItem = {
	id: "starter:rusty_sword",
	templateId: "rusty_sword",
	templateName: "Rusty Sword",
	equipmentType: "weapon",
	weaponType: "sword",
	rarity: "normal",
	name: "Rusty Sword",
	itemLevel: 1,
	baseStats: {
		minDamage: 1,
		maxDamage: 5,
		attackSpeed: 1.0,
		criticalChance: 5,
	},
	implicits: [],
	explicits: [],
	computedStats: {
		physicalDamage: { min: 1, max: 5 },
		elementalDamage: [],
		attackSpeed: 1.0,
		criticalChance: 5,
	},
};

const rustyDagger: GeneratedItem = {
	id: "starter:rusty_dagger",
	templateId: "rusty_dagger",
	templateName: "Rusty Dagger",
	equipmentType: "weapon",
	weaponType: "dagger",
	rarity: "normal",
	name: "Rusty Dagger",
	itemLevel: 1,
	baseStats: {
		minDamage: 1,
		maxDamage: 3,
		attackSpeed: 1.6,
		criticalChance: 8,
	},
	implicits: [],
	explicits: [],
	computedStats: {
		physicalDamage: { min: 1, max: 3 },
		elementalDamage: [],
		attackSpeed: 1.6,
		criticalChance: 8,
	},
};

const crackedWand: GeneratedItem = {
	id: "starter:cracked_wand",
	templateId: "cracked_wand",
	templateName: "Cracked Wand",
	equipmentType: "weapon",
	weaponType: "wand",
	rarity: "normal",
	name: "Cracked Wand",
	itemLevel: 1,
	baseStats: {
		criticalChance: 6,
	},
	implicits: [],
	explicits: [],
	computedStats: {
		physicalDamage: { min: 0, max: 0 },
		elementalDamage: [],
		attackSpeed: 0,
		criticalChance: 6,
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
