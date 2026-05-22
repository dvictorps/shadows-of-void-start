import type { EquipmentTemplate } from "./types";

// Rings — one base per implicit type, no tier progression
export const RING_TEMPLATES: EquipmentTemplate[] = [
	{
		id: "cobalt_ring",
		nameBase: "ring",
		nameModifier: "cobalt",
		equipmentType: "ring",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [
			{
				modifierId: "coldResistance",
				displayFormat: "+{value}% Cold Resistance",
				minValue: 15,
				maxValue: 25,
			},
		],
		icon: "/assets/sprites/acessorios/anelCobalto.png",
	},
	{
		id: "garnet_ring",
		nameBase: "ring",
		nameModifier: "garnet",
		equipmentType: "ring",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [
			{
				modifierId: "fireResistance",
				displayFormat: "+{value}% Fire Resistance",
				minValue: 15,
				maxValue: 25,
			},
		],
		icon: "/assets/sprites/acessorios/anelCarmesin.png",
	},
	{
		id: "topaz_ring",
		nameBase: "ring",
		nameModifier: "topaz",
		equipmentType: "ring",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [
			{
				modifierId: "lightningResistance",
				displayFormat: "+{value}% Lightning Resistance",
				minValue: 15,
				maxValue: 25,
			},
		],
		icon: "/assets/sprites/acessorios/anelEsmeralda.png",
	},
	{
		id: "obsidian_ring",
		nameBase: "ring",
		nameModifier: "obsidian",
		equipmentType: "ring",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [
			{
				modifierId: "voidResistance",
				displayFormat: "+{value}% Void Resistance",
				minValue: 15,
				maxValue: 25,
			},
		],
		icon: "/assets/sprites/acessorios/anelCaveira.png",
	},
	{
		id: "coral_ring",
		nameBase: "ring",
		nameModifier: "coral",
		equipmentType: "ring",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [
			{
				modifierId: "healthFlat",
				displayFormat: "+{value} to Maximum Life",
				minValue: 15,
				maxValue: 30,
			},
		],
		icon: "/assets/sprites/acessorios/anelCarmesin.png",
	},
	{
		id: "lapis_ring",
		nameBase: "ring",
		nameModifier: "lapis",
		equipmentType: "ring",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [
			{
				modifierId: "manaFlat",
				displayFormat: "+{value} to Maximum Mana",
				minValue: 15,
				maxValue: 30,
			},
		],
		icon: "/assets/sprites/acessorios/anelCobalto.png",
	},
];
