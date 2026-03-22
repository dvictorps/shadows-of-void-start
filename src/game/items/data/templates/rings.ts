import type { EquipmentTemplate } from "./types";

// Rings — one base per implicit type, no tier progression
export const RING_TEMPLATES: EquipmentTemplate[] = [
	{
		id: "cobalt_ring",
		name: "Cobalt Ring",
		equipmentType: "ring",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [
			{
				displayFormat: "+{value}% Cold Resistance",
				minValue: 15,
				maxValue: 25,
			},
		],
	},
	{
		id: "garnet_ring",
		name: "Garnet Ring",
		equipmentType: "ring",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [
			{
				displayFormat: "+{value}% Fire Resistance",
				minValue: 15,
				maxValue: 25,
			},
		],
	},
	{
		id: "topaz_ring",
		name: "Topaz Ring",
		equipmentType: "ring",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [
			{
				displayFormat: "+{value}% Lightning Resistance",
				minValue: 15,
				maxValue: 25,
			},
		],
	},
	{
		id: "obsidian_ring",
		name: "Obsidian Ring",
		equipmentType: "ring",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [
			{
				displayFormat: "+{value}% Void Resistance",
				minValue: 15,
				maxValue: 25,
			},
		],
	},
	{
		id: "coral_ring",
		name: "Coral Ring",
		equipmentType: "ring",
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
		id: "lapis_ring",
		name: "Lapis Ring",
		equipmentType: "ring",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [
			{
				displayFormat: "+{value} to Maximum Mana",
				minValue: 15,
				maxValue: 30,
			},
		],
	},
];
