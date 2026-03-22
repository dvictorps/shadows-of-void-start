import type { EquipmentTemplate } from "./types";

// Amulets — one base per attribute type, no tier progression
export const AMULET_TEMPLATES: EquipmentTemplate[] = [
	{
		id: "gold_amulet",
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
		id: "jade_amulet",
		name: "Jade Amulet",
		equipmentType: "amulet",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [
			{
				displayFormat: "+{value} Dexterity",
				minValue: 10,
				maxValue: 20,
			},
		],
	},
	{
		id: "amber_amulet",
		name: "Amber Amulet",
		equipmentType: "amulet",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [
			{
				displayFormat: "+{value} Strength",
				minValue: 10,
				maxValue: 20,
			},
		],
	},
	{
		id: "lapis_amulet",
		name: "Lapis Amulet",
		equipmentType: "amulet",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [
			{
				displayFormat: "+{value} Intelligence",
				minValue: 10,
				maxValue: 20,
			},
		],
	},
];
