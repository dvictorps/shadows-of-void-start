import type { EquipmentTemplate } from "./types";

// ── Leather Belt (Maximum Life) ──
const LEATHER_BELT_TEMPLATES: EquipmentTemplate[] = [
	{
		id: "leather_belt_t1",
		name: "Leather Belt",
		equipmentType: "belt",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} to Maximum Life", minValue: 15, maxValue: 30 },
		],
	},
	{
		id: "leather_belt_t2",
		name: "Leather Strap",
		equipmentType: "belt",
		dropLevel: 12,
		requirements: { level: 12 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} to Maximum Life", minValue: 18, maxValue: 35 },
		],
	},
	{
		id: "leather_belt_t3",
		name: "Leather Girdle",
		equipmentType: "belt",
		dropLevel: 24,
		requirements: { level: 24 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} to Maximum Life", minValue: 22, maxValue: 40 },
		],
	},
	{
		id: "leather_belt_t4",
		name: "Leather Cinch",
		equipmentType: "belt",
		dropLevel: 36,
		requirements: { level: 36 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} to Maximum Life", minValue: 26, maxValue: 46 },
		],
	},
	{
		id: "leather_belt_t5",
		name: "Leather Sash",
		equipmentType: "belt",
		dropLevel: 48,
		requirements: { level: 48 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} to Maximum Life", minValue: 30, maxValue: 52 },
		],
	},
	{
		id: "leather_belt_t6",
		name: "Leather Clasp",
		equipmentType: "belt",
		dropLevel: 60,
		requirements: { level: 60 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} to Maximum Life", minValue: 35, maxValue: 58 },
		],
	},
	{
		id: "leather_belt_t7",
		name: "Leather Waistguard",
		equipmentType: "belt",
		dropLevel: 72,
		requirements: { level: 72 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} to Maximum Life", minValue: 40, maxValue: 65 },
		],
	},
	{
		id: "leather_belt_t8",
		name: "Void-Leather Belt",
		equipmentType: "belt",
		dropLevel: 83,
		requirements: { level: 83 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} to Maximum Life", minValue: 45, maxValue: 72 },
		],
	},
];

// ── Chain Belt (Strength) ──
const CHAIN_BELT_TEMPLATES: EquipmentTemplate[] = [
	{
		id: "chain_belt_t1",
		name: "Chain Belt",
		equipmentType: "belt",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Strength", minValue: 10, maxValue: 20 },
		],
	},
	{
		id: "chain_belt_t2",
		name: "Chain Strap",
		equipmentType: "belt",
		dropLevel: 12,
		requirements: { level: 12 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Strength", minValue: 13, maxValue: 24 },
		],
	},
	{
		id: "chain_belt_t3",
		name: "Chain Girdle",
		equipmentType: "belt",
		dropLevel: 24,
		requirements: { level: 24 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Strength", minValue: 16, maxValue: 28 },
		],
	},
	{
		id: "chain_belt_t4",
		name: "Chain Cinch",
		equipmentType: "belt",
		dropLevel: 36,
		requirements: { level: 36 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Strength", minValue: 19, maxValue: 33 },
		],
	},
	{
		id: "chain_belt_t5",
		name: "Chain Sash",
		equipmentType: "belt",
		dropLevel: 48,
		requirements: { level: 48 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Strength", minValue: 22, maxValue: 38 },
		],
	},
	{
		id: "chain_belt_t6",
		name: "Chain Clasp",
		equipmentType: "belt",
		dropLevel: 60,
		requirements: { level: 60 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Strength", minValue: 25, maxValue: 42 },
		],
	},
	{
		id: "chain_belt_t7",
		name: "Chain Waistguard",
		equipmentType: "belt",
		dropLevel: 72,
		requirements: { level: 72 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Strength", minValue: 28, maxValue: 46 },
		],
	},
	{
		id: "chain_belt_t8",
		name: "Void-Chain Belt",
		equipmentType: "belt",
		dropLevel: 83,
		requirements: { level: 83 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Strength", minValue: 30, maxValue: 50 },
		],
	},
];

// ── Studded Belt (Dexterity) ──
const STUDDED_BELT_TEMPLATES: EquipmentTemplate[] = [
	{
		id: "studded_belt_t1",
		name: "Studded Belt",
		equipmentType: "belt",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Dexterity", minValue: 10, maxValue: 20 },
		],
	},
	{
		id: "studded_belt_t2",
		name: "Studded Strap",
		equipmentType: "belt",
		dropLevel: 12,
		requirements: { level: 12 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Dexterity", minValue: 13, maxValue: 24 },
		],
	},
	{
		id: "studded_belt_t3",
		name: "Studded Girdle",
		equipmentType: "belt",
		dropLevel: 24,
		requirements: { level: 24 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Dexterity", minValue: 16, maxValue: 28 },
		],
	},
	{
		id: "studded_belt_t4",
		name: "Studded Cinch",
		equipmentType: "belt",
		dropLevel: 36,
		requirements: { level: 36 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Dexterity", minValue: 19, maxValue: 33 },
		],
	},
	{
		id: "studded_belt_t5",
		name: "Studded Sash",
		equipmentType: "belt",
		dropLevel: 48,
		requirements: { level: 48 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Dexterity", minValue: 22, maxValue: 38 },
		],
	},
	{
		id: "studded_belt_t6",
		name: "Studded Clasp",
		equipmentType: "belt",
		dropLevel: 60,
		requirements: { level: 60 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Dexterity", minValue: 25, maxValue: 42 },
		],
	},
	{
		id: "studded_belt_t7",
		name: "Studded Waistguard",
		equipmentType: "belt",
		dropLevel: 72,
		requirements: { level: 72 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Dexterity", minValue: 28, maxValue: 46 },
		],
	},
	{
		id: "studded_belt_t8",
		name: "Void-Studded Belt",
		equipmentType: "belt",
		dropLevel: 83,
		requirements: { level: 83 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Dexterity", minValue: 30, maxValue: 50 },
		],
	},
];

// ── Cloth Belt (Intelligence) ──
const CLOTH_BELT_TEMPLATES: EquipmentTemplate[] = [
	{
		id: "cloth_belt_t1",
		name: "Cloth Belt",
		equipmentType: "belt",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Intelligence", minValue: 10, maxValue: 20 },
		],
	},
	{
		id: "cloth_belt_t2",
		name: "Cloth Strap",
		equipmentType: "belt",
		dropLevel: 12,
		requirements: { level: 12 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Intelligence", minValue: 13, maxValue: 24 },
		],
	},
	{
		id: "cloth_belt_t3",
		name: "Cloth Girdle",
		equipmentType: "belt",
		dropLevel: 24,
		requirements: { level: 24 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Intelligence", minValue: 16, maxValue: 28 },
		],
	},
	{
		id: "cloth_belt_t4",
		name: "Cloth Cinch",
		equipmentType: "belt",
		dropLevel: 36,
		requirements: { level: 36 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Intelligence", minValue: 19, maxValue: 33 },
		],
	},
	{
		id: "cloth_belt_t5",
		name: "Cloth Sash",
		equipmentType: "belt",
		dropLevel: 48,
		requirements: { level: 48 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Intelligence", minValue: 22, maxValue: 38 },
		],
	},
	{
		id: "cloth_belt_t6",
		name: "Cloth Clasp",
		equipmentType: "belt",
		dropLevel: 60,
		requirements: { level: 60 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Intelligence", minValue: 25, maxValue: 42 },
		],
	},
	{
		id: "cloth_belt_t7",
		name: "Cloth Waistguard",
		equipmentType: "belt",
		dropLevel: 72,
		requirements: { level: 72 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Intelligence", minValue: 28, maxValue: 46 },
		],
	},
	{
		id: "cloth_belt_t8",
		name: "Void-Cloth Belt",
		equipmentType: "belt",
		dropLevel: 83,
		requirements: { level: 83 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Intelligence", minValue: 30, maxValue: 50 },
		],
	},
];

export const BELT_TEMPLATES: EquipmentTemplate[] = [
	...LEATHER_BELT_TEMPLATES,
	...CHAIN_BELT_TEMPLATES,
	...STUDDED_BELT_TEMPLATES,
	...CLOTH_BELT_TEMPLATES,
];
