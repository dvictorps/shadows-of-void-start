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
		name: "Garnet Ring",
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
		name: "Topaz Ring",
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
		name: "Obsidian Ring",
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
		name: "Coral Ring",
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
		name: "Lapis Ring",
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
