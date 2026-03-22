import type { EquipmentTemplate } from "./types";

// ── Gold Amulet (all Attributes) ──
const GOLD_AMULET_TEMPLATES: EquipmentTemplate[] = [
	{
		id: "gold_amulet_t1",
		name: "Gold Amulet",
		equipmentType: "amulet",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [
			{
				displayFormat: "+{value} to all Attributes",
				minValue: 5,
				maxValue: 10,
			},
		],
	},
	{
		id: "gold_amulet_t2",
		name: "Gold Pendant",
		equipmentType: "amulet",
		dropLevel: 12,
		requirements: { level: 12 },
		baseStats: {},
		implicits: [
			{
				displayFormat: "+{value} to all Attributes",
				minValue: 7,
				maxValue: 13,
			},
		],
	},
	{
		id: "gold_amulet_t3",
		name: "Gold Talisman",
		equipmentType: "amulet",
		dropLevel: 24,
		requirements: { level: 24 },
		baseStats: {},
		implicits: [
			{
				displayFormat: "+{value} to all Attributes",
				minValue: 9,
				maxValue: 16,
			},
		],
	},
	{
		id: "gold_amulet_t4",
		name: "Gold Choker",
		equipmentType: "amulet",
		dropLevel: 36,
		requirements: { level: 36 },
		baseStats: {},
		implicits: [
			{
				displayFormat: "+{value} to all Attributes",
				minValue: 11,
				maxValue: 19,
			},
		],
	},
	{
		id: "gold_amulet_t5",
		name: "Gold Locket",
		equipmentType: "amulet",
		dropLevel: 48,
		requirements: { level: 48 },
		baseStats: {},
		implicits: [
			{
				displayFormat: "+{value} to all Attributes",
				minValue: 13,
				maxValue: 22,
			},
		],
	},
	{
		id: "gold_amulet_t6",
		name: "Gold Gorget",
		equipmentType: "amulet",
		dropLevel: 60,
		requirements: { level: 60 },
		baseStats: {},
		implicits: [
			{
				displayFormat: "+{value} to all Attributes",
				minValue: 16,
				maxValue: 26,
			},
		],
	},
	{
		id: "gold_amulet_t7",
		name: "Gold Torque",
		equipmentType: "amulet",
		dropLevel: 72,
		requirements: { level: 72 },
		baseStats: {},
		implicits: [
			{
				displayFormat: "+{value} to all Attributes",
				minValue: 19,
				maxValue: 30,
			},
		],
	},
	{
		id: "gold_amulet_t8",
		name: "Void-Gold Amulet",
		equipmentType: "amulet",
		dropLevel: 83,
		requirements: { level: 83 },
		baseStats: {},
		implicits: [
			{
				displayFormat: "+{value} to all Attributes",
				minValue: 22,
				maxValue: 35,
			},
		],
	},
];

// ── Jade Amulet (Dexterity) ──
const JADE_AMULET_TEMPLATES: EquipmentTemplate[] = [
	{
		id: "jade_amulet_t1",
		name: "Jade Amulet",
		equipmentType: "amulet",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Dexterity", minValue: 10, maxValue: 20 },
		],
	},
	{
		id: "jade_amulet_t2",
		name: "Jade Pendant",
		equipmentType: "amulet",
		dropLevel: 12,
		requirements: { level: 12 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Dexterity", minValue: 13, maxValue: 24 },
		],
	},
	{
		id: "jade_amulet_t3",
		name: "Jade Talisman",
		equipmentType: "amulet",
		dropLevel: 24,
		requirements: { level: 24 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Dexterity", minValue: 16, maxValue: 29 },
		],
	},
	{
		id: "jade_amulet_t4",
		name: "Jade Choker",
		equipmentType: "amulet",
		dropLevel: 36,
		requirements: { level: 36 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Dexterity", minValue: 19, maxValue: 34 },
		],
	},
	{
		id: "jade_amulet_t5",
		name: "Jade Locket",
		equipmentType: "amulet",
		dropLevel: 48,
		requirements: { level: 48 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Dexterity", minValue: 22, maxValue: 39 },
		],
	},
	{
		id: "jade_amulet_t6",
		name: "Jade Gorget",
		equipmentType: "amulet",
		dropLevel: 60,
		requirements: { level: 60 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Dexterity", minValue: 26, maxValue: 44 },
		],
	},
	{
		id: "jade_amulet_t7",
		name: "Jade Torque",
		equipmentType: "amulet",
		dropLevel: 72,
		requirements: { level: 72 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Dexterity", minValue: 30, maxValue: 50 },
		],
	},
	{
		id: "jade_amulet_t8",
		name: "Void-Jade Amulet",
		equipmentType: "amulet",
		dropLevel: 83,
		requirements: { level: 83 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Dexterity", minValue: 35, maxValue: 55 },
		],
	},
];

// ── Amber Amulet (Strength) ──
const AMBER_AMULET_TEMPLATES: EquipmentTemplate[] = [
	{
		id: "amber_amulet_t1",
		name: "Amber Amulet",
		equipmentType: "amulet",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Strength", minValue: 10, maxValue: 20 },
		],
	},
	{
		id: "amber_amulet_t2",
		name: "Amber Pendant",
		equipmentType: "amulet",
		dropLevel: 12,
		requirements: { level: 12 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Strength", minValue: 13, maxValue: 24 },
		],
	},
	{
		id: "amber_amulet_t3",
		name: "Amber Talisman",
		equipmentType: "amulet",
		dropLevel: 24,
		requirements: { level: 24 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Strength", minValue: 16, maxValue: 29 },
		],
	},
	{
		id: "amber_amulet_t4",
		name: "Amber Choker",
		equipmentType: "amulet",
		dropLevel: 36,
		requirements: { level: 36 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Strength", minValue: 19, maxValue: 34 },
		],
	},
	{
		id: "amber_amulet_t5",
		name: "Amber Locket",
		equipmentType: "amulet",
		dropLevel: 48,
		requirements: { level: 48 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Strength", minValue: 22, maxValue: 39 },
		],
	},
	{
		id: "amber_amulet_t6",
		name: "Amber Gorget",
		equipmentType: "amulet",
		dropLevel: 60,
		requirements: { level: 60 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Strength", minValue: 26, maxValue: 44 },
		],
	},
	{
		id: "amber_amulet_t7",
		name: "Amber Torque",
		equipmentType: "amulet",
		dropLevel: 72,
		requirements: { level: 72 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Strength", minValue: 30, maxValue: 50 },
		],
	},
	{
		id: "amber_amulet_t8",
		name: "Void-Amber Amulet",
		equipmentType: "amulet",
		dropLevel: 83,
		requirements: { level: 83 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Strength", minValue: 35, maxValue: 55 },
		],
	},
];

// ── Lapis Amulet (Intelligence) ──
const LAPIS_AMULET_TEMPLATES: EquipmentTemplate[] = [
	{
		id: "lapis_amulet_t1",
		name: "Lapis Amulet",
		equipmentType: "amulet",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Intelligence", minValue: 10, maxValue: 20 },
		],
	},
	{
		id: "lapis_amulet_t2",
		name: "Lapis Pendant",
		equipmentType: "amulet",
		dropLevel: 12,
		requirements: { level: 12 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Intelligence", minValue: 13, maxValue: 24 },
		],
	},
	{
		id: "lapis_amulet_t3",
		name: "Lapis Talisman",
		equipmentType: "amulet",
		dropLevel: 24,
		requirements: { level: 24 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Intelligence", minValue: 16, maxValue: 29 },
		],
	},
	{
		id: "lapis_amulet_t4",
		name: "Lapis Choker",
		equipmentType: "amulet",
		dropLevel: 36,
		requirements: { level: 36 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Intelligence", minValue: 19, maxValue: 34 },
		],
	},
	{
		id: "lapis_amulet_t5",
		name: "Lapis Locket",
		equipmentType: "amulet",
		dropLevel: 48,
		requirements: { level: 48 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Intelligence", minValue: 22, maxValue: 39 },
		],
	},
	{
		id: "lapis_amulet_t6",
		name: "Lapis Gorget",
		equipmentType: "amulet",
		dropLevel: 60,
		requirements: { level: 60 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Intelligence", minValue: 26, maxValue: 44 },
		],
	},
	{
		id: "lapis_amulet_t7",
		name: "Lapis Torque",
		equipmentType: "amulet",
		dropLevel: 72,
		requirements: { level: 72 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Intelligence", minValue: 30, maxValue: 50 },
		],
	},
	{
		id: "lapis_amulet_t8",
		name: "Void-Lapis Amulet",
		equipmentType: "amulet",
		dropLevel: 83,
		requirements: { level: 83 },
		baseStats: {},
		implicits: [
			{ displayFormat: "+{value} Intelligence", minValue: 35, maxValue: 55 },
		],
	},
];

export const AMULET_TEMPLATES: EquipmentTemplate[] = [
	...GOLD_AMULET_TEMPLATES,
	...JADE_AMULET_TEMPLATES,
	...AMBER_AMULET_TEMPLATES,
	...LAPIS_AMULET_TEMPLATES,
];
