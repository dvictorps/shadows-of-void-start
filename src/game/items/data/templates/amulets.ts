import type { EquipmentTemplate } from "./types";

// Amulets — one base per attribute type, no tier progression
export const AMULET_TEMPLATES: EquipmentTemplate[] = [
	{
		id: "gold_amulet",
		name: "Amuleto",
		equipmentType: "amulet",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [
			{
				modifierId: "allAttributesFlat",
				displayFormat: "+{value} to all Attributes",
				minValue: 5,
				maxValue: 10,
			},
		],
		icon: "/assets/sprites/acessorios/amuleto.png",
	},
	{
		id: "jade_amulet",
		name: "Amuleto de Esmeralda",
		equipmentType: "amulet",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [
			{
				modifierId: "dexterityFlat",
				displayFormat: "+{value} Dexterity",
				minValue: 10,
				maxValue: 20,
			},
		],
		icon: "/assets/sprites/acessorios/amuletoEsmeralda.png",
	},
	{
		id: "amber_amulet",
		name: "Amuleto Sombrio",
		equipmentType: "amulet",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [
			{
				modifierId: "strengthFlat",
				displayFormat: "+{value} Strength",
				minValue: 10,
				maxValue: 20,
			},
		],
		icon: "/assets/sprites/acessorios/amuletoSombrio.png",
	},
	{
		id: "lapis_amulet",
		name: "Amuleto do Conhecimento",
		equipmentType: "amulet",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [
			{
				modifierId: "intelligenceFlat",
				displayFormat: "+{value} Intelligence",
				minValue: 10,
				maxValue: 20,
			},
		],
		icon: "/assets/sprites/acessorios/amuletoConhecimento.png",
	},
];
