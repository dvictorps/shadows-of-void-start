import type { EquipmentTemplate } from "./types";

// Belts — one base per implicit type, no tier progression
export const BELT_TEMPLATES: EquipmentTemplate[] = [
	{
		id: "leather_belt",		equipmentType: "belt",
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
		icon: "/assets/sprites/acessorios/cinto.png",
	},
	{
		id: "chain_belt",		equipmentType: "belt",
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
		icon: "/assets/sprites/acessorios/cintoLutador.png",
	},
	{
		id: "studded_belt",		equipmentType: "belt",
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
		icon: "/assets/sprites/acessorios/cintoAventureiro.png",
	},
	{
		id: "cloth_belt",		equipmentType: "belt",
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
		icon: "/assets/sprites/acessorios/cintoConhecimento.png",
	},
	{
		id: "prismatic_belt",		equipmentType: "belt",
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
		icon: "/assets/sprites/acessorios/cinto.png",
	},
	{
		id: "silk_belt",		equipmentType: "belt",
		dropLevel: 1,
		requirements: { level: 1 },
		baseStats: {},
		implicits: [
			{
				modifierId: "barrierFlat",
				displayFormat: "+{value} to Maximum Barrier",
				minValue: 15,
				maxValue: 30,
			},
		],
		icon: "/assets/sprites/acessorios/cintoConhecimento.png",
	},
];
