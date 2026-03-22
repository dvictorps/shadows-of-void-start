import type { EquipmentTemplate } from "./types";

// Belts — one base per implicit type, no tier progression
export const BELT_TEMPLATES: EquipmentTemplate[] = [
	{
		id: "leather_belt",
		name: "Leather Belt",
		equipmentType: "belt",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [
			{
				displayFormat: "+{value} to Maximum Life",
				minValue: 15,
				maxValue: 30,
			},
		],
	},
	{
		id: "chain_belt",
		name: "Chain Belt",
		equipmentType: "belt",
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
		id: "studded_belt",
		name: "Studded Belt",
		equipmentType: "belt",
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
		id: "cloth_belt",
		name: "Cloth Belt",
		equipmentType: "belt",
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
	{
		id: "prismatic_belt",
		name: "Prismatic Belt",
		equipmentType: "belt",
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
		id: "silk_belt",
		name: "Silk Belt",
		equipmentType: "belt",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [
			{
				displayFormat: "+{value} to Maximum Barrier",
				minValue: 15,
				maxValue: 30,
			},
		],
	},
];
