import type { CharacterClassId } from "../classes/types";
import type { GeneratedItem } from "./types";

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

const apprenticeTome: GeneratedItem = {
	id: "starter:apprentice_tome",
	templateId: "tome_t1",
	nameBase: "tome",
	nameModifier: "apprentice",
	equipmentType: "tome",
	armorType: "silk",
	rarity: "normal",
	itemLevel: 1,
	icon: "/assets/sprites/escudos-offhands/tomoMagico.png",
	baseStats: { barrier: 12 },
	implicits: [
		{
			modifierId: "globalSpellDamageIncrease",
			description: "+10% increased Spell Damage",
			value: 10,
		},
	],
	explicits: [],
	computedDefenseStats: { barrier: 12 },
	requirements: { level: 1, int: 10 },
};

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

const STARTER_ITEMS: ReadonlyMap<string, GeneratedItem> = new Map([
	["starter:rusty_sword", rustySword],
	["starter:rusty_dagger", rustyDagger],
	["starter:cracked_wand", crackedWand],
	["starter:tattered_leather_vest", tatteredLeatherVest],
	["starter:apprentice_tome", apprenticeTome],
]);

export const STARTER_WEAPON_BY_CLASS = {
	warrior: "starter:rusty_sword",
	rogue: "starter:rusty_dagger",
	mage: "starter:cracked_wand",
} satisfies Record<CharacterClassId, string>;

export const STARTER_CHESTPLATE_BY_CLASS = {
	warrior: undefined,
	rogue: "starter:tattered_leather_vest",
	mage: undefined,
} satisfies Record<CharacterClassId, string | undefined>;

export const STARTER_OFFHAND_BY_CLASS = {
	warrior: undefined,
	rogue: undefined,
	mage: "starter:apprentice_tome",
} satisfies Record<CharacterClassId, string | undefined>;

export function findStarterItem(id: string): GeneratedItem | null {
	return STARTER_ITEMS.get(id) ?? null;
}
