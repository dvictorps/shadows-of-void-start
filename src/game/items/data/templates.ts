import type { ArmorType, BaseStatKey, EquipmentType, WeaponType } from "../types"

// ── Template types ──

export interface ImplicitDefinition {
	displayFormat: string
	minValue: number
	maxValue: number
}

export interface EquipmentTemplate {
	id: string
	name: string
	equipmentType: EquipmentType
	weaponType?: WeaponType
	armorType?: ArmorType
	dropLevel: number
	requirements: {
		level: number
		str?: number
		dex?: number
		int?: number
	}
	baseStats: Partial<Record<BaseStatKey, number>>
	implicits: ImplicitDefinition[]
}

// ── Templates ──

export const EQUIPMENT_TEMPLATES: EquipmentTemplate[] = [
	// ── Physical Weapons ──
	{
		id: "iron_sword",
		name: "Iron Sword",
		equipmentType: "weapon",
		weaponType: "sword",
		dropLevel: 1,
		requirements: { level: 1, str: 10, dex: 10 },
		baseStats: { minDamage: 12, maxDamage: 28, attackSpeed: 1.5, criticalChance: 5 },
		implicits: [{ displayFormat: "+{value} Accuracy Rating", minValue: 60, maxValue: 100 }],
	},
	{
		id: "iron_greatsword",
		name: "Iron Greatsword",
		equipmentType: "weapon",
		weaponType: "greatsword",
		dropLevel: 1,
		requirements: { level: 1, str: 20 },
		baseStats: { minDamage: 25, maxDamage: 55, attackSpeed: 1.1, criticalChance: 5 },
		implicits: [],
	},
	{
		id: "iron_dagger",
		name: "Iron Dagger",
		equipmentType: "weapon",
		weaponType: "dagger",
		dropLevel: 1,
		requirements: { level: 1, dex: 10 },
		baseStats: { minDamage: 8, maxDamage: 18, attackSpeed: 1.7, criticalChance: 6.5 },
		implicits: [{ displayFormat: "+{value}% Critical Strike Multiplier", minValue: 20, maxValue: 30 }],
	},
	{
		id: "oak_bow",
		name: "Oak Bow",
		equipmentType: "weapon",
		weaponType: "bow",
		dropLevel: 1,
		requirements: { level: 1, dex: 15 },
		baseStats: { minDamage: 15, maxDamage: 45, attackSpeed: 1.3, criticalChance: 5 },
		implicits: [],
	},
	{
		id: "iron_axe",
		name: "Iron Axe",
		equipmentType: "weapon",
		weaponType: "axe",
		dropLevel: 1,
		requirements: { level: 1, str: 15 },
		baseStats: { minDamage: 15, maxDamage: 32, attackSpeed: 1.3, criticalChance: 5 },
		implicits: [],
	},
	{
		id: "iron_mace",
		name: "Iron Mace",
		equipmentType: "weapon",
		weaponType: "mace",
		dropLevel: 1,
		requirements: { level: 1, str: 15 },
		baseStats: { minDamage: 18, maxDamage: 35, attackSpeed: 1.15, criticalChance: 5 },
		implicits: [],
	},
	{
		id: "iron_greataxe",
		name: "Iron Greataxe",
		equipmentType: "weapon",
		weaponType: "twoHandedAxe",
		dropLevel: 1,
		requirements: { level: 1, str: 25 },
		baseStats: { minDamage: 30, maxDamage: 60, attackSpeed: 1.05, criticalChance: 5 },
		implicits: [],
	},

	// ── Spell Weapons ──
	{
		id: "apprentice_staff",
		name: "Apprentice Staff",
		equipmentType: "weapon",
		weaponType: "staff",
		dropLevel: 1,
		requirements: { level: 1, int: 15 },
		baseStats: { minDamage: 10, maxDamage: 30, attackSpeed: 1.2, criticalChance: 6 },
		implicits: [{ displayFormat: "+{value}% Spell Damage", minValue: 15, maxValue: 25 }],
	},
	{
		id: "apprentice_wand",
		name: "Apprentice Wand",
		equipmentType: "weapon",
		weaponType: "wand",
		dropLevel: 1,
		requirements: { level: 1, int: 10 },
		baseStats: { minDamage: 8, maxDamage: 22, attackSpeed: 1.4, criticalChance: 7 },
		implicits: [{ displayFormat: "+{value}% Spell Damage", minValue: 10, maxValue: 20 }],
	},

	// ── Armor (Plate) ──
	{
		id: "plate_helmet",
		name: "Plate Helmet",
		equipmentType: "helmet",
		armorType: "plate",
		dropLevel: 1,
		requirements: { level: 1, str: 10 },
		baseStats: { armor: 120 },
		implicits: [],
	},
	{
		id: "plate_chestplate",
		name: "Plate Chestplate",
		equipmentType: "chestplate",
		armorType: "plate",
		dropLevel: 1,
		requirements: { level: 1, str: 15 },
		baseStats: { armor: 350 },
		implicits: [],
	},
	{
		id: "plate_boots",
		name: "Plate Boots",
		equipmentType: "boots",
		armorType: "plate",
		dropLevel: 1,
		requirements: { level: 1, str: 10 },
		baseStats: { armor: 100 },
		implicits: [],
	},
	{
		id: "plate_gloves",
		name: "Plate Gloves",
		equipmentType: "gloves",
		armorType: "plate",
		dropLevel: 1,
		requirements: { level: 1, str: 10 },
		baseStats: { armor: 100 },
		implicits: [],
	},

	// ── Offhand ──
	{
		id: "wooden_shield",
		name: "Wooden Shield",
		equipmentType: "offhand",
		armorType: "plate",
		dropLevel: 1,
		requirements: { level: 1, str: 10 },
		baseStats: { armor: 80, evasion: 40, blockChance: 22 },
		implicits: [{ displayFormat: "+{value}% Block Chance", minValue: 10, maxValue: 20 }],
	},

	// ── Jewelry: Rings ──
	{
		id: "cobalt_ring",
		name: "Cobalt Ring",
		equipmentType: "ring",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [{ displayFormat: "+{value}% Cold Resistance", minValue: 15, maxValue: 25 }],
	},
	{
		id: "garnet_ring",
		name: "Garnet Ring",
		equipmentType: "ring",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [{ displayFormat: "+{value}% Fire Resistance", minValue: 15, maxValue: 25 }],
	},
	{
		id: "topaz_ring",
		name: "Topaz Ring",
		equipmentType: "ring",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [{ displayFormat: "+{value}% Lightning Resistance", minValue: 15, maxValue: 25 }],
	},
	{
		id: "obsidian_ring",
		name: "Obsidian Ring",
		equipmentType: "ring",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [{ displayFormat: "+{value}% Void Resistance", minValue: 15, maxValue: 25 }],
	},
	{
		id: "coral_ring",
		name: "Coral Ring",
		equipmentType: "ring",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [{ displayFormat: "+{value} to Maximum Life", minValue: 15, maxValue: 30 }],
	},
	{
		id: "lapis_ring",
		name: "Lapis Ring",
		equipmentType: "ring",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [{ displayFormat: "+{value} to Maximum Mana", minValue: 15, maxValue: 30 }],
	},

	// ── Jewelry: Amulets ──
	{
		id: "gold_amulet",
		name: "Gold Amulet",
		equipmentType: "amulet",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [{ displayFormat: "+{value} to all Attributes", minValue: 5, maxValue: 10 }],
	},
	{
		id: "jade_amulet",
		name: "Jade Amulet",
		equipmentType: "amulet",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [{ displayFormat: "+{value} Dexterity", minValue: 10, maxValue: 20 }],
	},
	{
		id: "amber_amulet",
		name: "Amber Amulet",
		equipmentType: "amulet",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [{ displayFormat: "+{value} Strength", minValue: 10, maxValue: 20 }],
	},
	{
		id: "lapis_amulet",
		name: "Lapis Amulet",
		equipmentType: "amulet",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [{ displayFormat: "+{value} Intelligence", minValue: 10, maxValue: 20 }],
	},

	// ── Jewelry: Belts ──
	{
		id: "leather_belt",
		name: "Leather Belt",
		equipmentType: "belt",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [{ displayFormat: "+{value} to Maximum Life", minValue: 15, maxValue: 30 }],
	},
	{
		id: "chain_belt",
		name: "Chain Belt",
		equipmentType: "belt",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [{ displayFormat: "+{value} Strength", minValue: 10, maxValue: 20 }],
	},
	{
		id: "studded_belt",
		name: "Studded Belt",
		equipmentType: "belt",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [{ displayFormat: "+{value} Dexterity", minValue: 10, maxValue: 20 }],
	},
	{
		id: "cloth_belt",
		name: "Cloth Belt",
		equipmentType: "belt",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [{ displayFormat: "+{value} Intelligence", minValue: 10, maxValue: 20 }],
	},
]

export const TEMPLATE_BY_ID = new Map(
	EQUIPMENT_TEMPLATES.map((t) => [t.id, t]),
)
