import type { EquipmentTemplate } from "./types";

// Daggers (1H, dex) — AtkSpd: 1.70, Crit: 6.5, Implicit: +{value}% Critical Strike Multiplier
export const DAGGER_TEMPLATES: EquipmentTemplate[] = [
	{
		id: "dagger_t1",		equipmentType: "weapon",
		weaponType: "dagger",
		dropLevel: 1,
		requirements: { level: 1, dex: 10 },
		baseStats: {
			minDamage: 2,
			maxDamage: 5,
			attackSpeed: 1.7,
			criticalChance: 6.5,
		},
		implicits: [
			{
				modifierId: "criticalStrikeMultiplierFlat",
				displayFormat: "+{value}% Critical Strike Multiplier",
				minValue: 20,
				maxValue: 30,
			},
		],
	},
	{
		id: "dagger_t2",		equipmentType: "weapon",
		weaponType: "dagger",
		dropLevel: 4,
		requirements: { level: 4, dex: 14 },
		baseStats: {
			minDamage: 3,
			maxDamage: 7,
			attackSpeed: 1.7,
			criticalChance: 6.5,
		},
		implicits: [
			{
				modifierId: "criticalStrikeMultiplierFlat",
				displayFormat: "+{value}% Critical Strike Multiplier",
				minValue: 22,
				maxValue: 34,
			},
		],
	},
	{
		id: "dagger_t3",		equipmentType: "weapon",
		weaponType: "dagger",
		dropLevel: 7,
		requirements: { level: 7, dex: 18 },
		baseStats: {
			minDamage: 4,
			maxDamage: 10,
			attackSpeed: 1.7,
			criticalChance: 6.5,
		},
		implicits: [
			{
				modifierId: "criticalStrikeMultiplierFlat",
				displayFormat: "+{value}% Critical Strike Multiplier",
				minValue: 24,
				maxValue: 38,
			},
		],
	},
	{
		id: "dagger_t4",		equipmentType: "weapon",
		weaponType: "dagger",
		dropLevel: 10,
		requirements: { level: 10, dex: 22 },
		baseStats: {
			minDamage: 6,
			maxDamage: 15,
			attackSpeed: 1.7,
			criticalChance: 6.5,
		},
		implicits: [
			{
				modifierId: "criticalStrikeMultiplierFlat",
				displayFormat: "+{value}% Critical Strike Multiplier",
				minValue: 26,
				maxValue: 42,
			},
		],
	},
	{
		id: "dagger_t5",		equipmentType: "weapon",
		weaponType: "dagger",
		dropLevel: 14,
		requirements: { level: 14, dex: 28 },
		baseStats: {
			minDamage: 10,
			maxDamage: 23,
			attackSpeed: 1.7,
			criticalChance: 6.5,
		},
		implicits: [
			{
				modifierId: "criticalStrikeMultiplierFlat",
				displayFormat: "+{value}% Critical Strike Multiplier",
				minValue: 28,
				maxValue: 46,
			},
		],
	},
	{
		id: "dagger_t6",		equipmentType: "weapon",
		weaponType: "dagger",
		dropLevel: 24,
		requirements: { level: 24, dex: 44 },
		baseStats: {
			minDamage: 20,
			maxDamage: 44,
			attackSpeed: 1.7,
			criticalChance: 6.5,
		},
		implicits: [
			{
				modifierId: "criticalStrikeMultiplierFlat",
				displayFormat: "+{value}% Critical Strike Multiplier",
				minValue: 30,
				maxValue: 50,
			},
		],
	},
	{
		id: "dagger_t7",		equipmentType: "weapon",
		weaponType: "dagger",
		dropLevel: 28,
		requirements: { level: 28, dex: 50 },
		baseStats: {
			minDamage: 23,
			maxDamage: 50,
			attackSpeed: 1.7,
			criticalChance: 6.5,
		},
		implicits: [
			{
				modifierId: "criticalStrikeMultiplierFlat",
				displayFormat: "+{value}% Critical Strike Multiplier",
				minValue: 32,
				maxValue: 54,
			},
		],
	},
	{
		id: "dagger_t8",		equipmentType: "weapon",
		weaponType: "dagger",
		dropLevel: 32,
		requirements: { level: 32, dex: 58 },
		baseStats: {
			minDamage: 26,
			maxDamage: 56,
			attackSpeed: 1.7,
			criticalChance: 6.5,
		},
		implicits: [
			{
				modifierId: "criticalStrikeMultiplierFlat",
				displayFormat: "+{value}% Critical Strike Multiplier",
				minValue: 34,
				maxValue: 58,
			},
		],
	},
	{
		id: "dagger_t9",		equipmentType: "weapon",
		weaponType: "dagger",
		dropLevel: 36,
		requirements: { level: 36, dex: 64 },
		baseStats: {
			minDamage: 29,
			maxDamage: 62,
			attackSpeed: 1.7,
			criticalChance: 6.5,
		},
		implicits: [
			{
				modifierId: "criticalStrikeMultiplierFlat",
				displayFormat: "+{value}% Critical Strike Multiplier",
				minValue: 36,
				maxValue: 62,
			},
		],
	},
	{
		id: "dagger_t10",		equipmentType: "weapon",
		weaponType: "dagger",
		dropLevel: 40,
		requirements: { level: 40, dex: 70 },
		baseStats: {
			minDamage: 32,
			maxDamage: 68,
			attackSpeed: 1.7,
			criticalChance: 6.5,
		},
		implicits: [
			{
				modifierId: "criticalStrikeMultiplierFlat",
				displayFormat: "+{value}% Critical Strike Multiplier",
				minValue: 38,
				maxValue: 66,
			},
		],
	},
	{
		id: "dagger_t11",		equipmentType: "weapon",
		weaponType: "dagger",
		dropLevel: 44,
		requirements: { level: 44, dex: 78 },
		baseStats: {
			minDamage: 35,
			maxDamage: 75,
			attackSpeed: 1.7,
			criticalChance: 6.5,
		},
		implicits: [
			{
				modifierId: "criticalStrikeMultiplierFlat",
				displayFormat: "+{value}% Critical Strike Multiplier",
				minValue: 40,
				maxValue: 70,
			},
		],
	},
	{
		id: "dagger_t12",		equipmentType: "weapon",
		weaponType: "dagger",
		dropLevel: 48,
		requirements: { level: 48, dex: 84 },
		baseStats: {
			minDamage: 38,
			maxDamage: 82,
			attackSpeed: 1.7,
			criticalChance: 6.5,
		},
		implicits: [
			{
				modifierId: "criticalStrikeMultiplierFlat",
				displayFormat: "+{value}% Critical Strike Multiplier",
				minValue: 42,
				maxValue: 74,
			},
		],
	},
	{
		id: "dagger_t13",		equipmentType: "weapon",
		weaponType: "dagger",
		dropLevel: 52,
		requirements: { level: 52, dex: 90 },
		baseStats: {
			minDamage: 42,
			maxDamage: 90,
			attackSpeed: 1.7,
			criticalChance: 6.5,
		},
		implicits: [
			{
				modifierId: "criticalStrikeMultiplierFlat",
				displayFormat: "+{value}% Critical Strike Multiplier",
				minValue: 44,
				maxValue: 78,
			},
		],
	},
	{
		id: "dagger_t14",		equipmentType: "weapon",
		weaponType: "dagger",
		dropLevel: 56,
		requirements: { level: 56, dex: 98 },
		baseStats: {
			minDamage: 45,
			maxDamage: 96,
			attackSpeed: 1.7,
			criticalChance: 6.5,
		},
		implicits: [
			{
				modifierId: "criticalStrikeMultiplierFlat",
				displayFormat: "+{value}% Critical Strike Multiplier",
				minValue: 46,
				maxValue: 82,
			},
		],
	},
	{
		id: "dagger_t15",		equipmentType: "weapon",
		weaponType: "dagger",
		dropLevel: 60,
		requirements: { level: 60, dex: 104 },
		baseStats: {
			minDamage: 48,
			maxDamage: 102,
			attackSpeed: 1.7,
			criticalChance: 6.5,
		},
		implicits: [
			{
				modifierId: "criticalStrikeMultiplierFlat",
				displayFormat: "+{value}% Critical Strike Multiplier",
				minValue: 48,
				maxValue: 86,
			},
		],
	},
	{
		id: "dagger_t16",		equipmentType: "weapon",
		weaponType: "dagger",
		dropLevel: 64,
		requirements: { level: 64, dex: 110 },
		baseStats: {
			minDamage: 51,
			maxDamage: 108,
			attackSpeed: 1.7,
			criticalChance: 6.5,
		},
		implicits: [
			{
				modifierId: "criticalStrikeMultiplierFlat",
				displayFormat: "+{value}% Critical Strike Multiplier",
				minValue: 50,
				maxValue: 90,
			},
		],
	},
	{
		id: "dagger_t17",		equipmentType: "weapon",
		weaponType: "dagger",
		dropLevel: 68,
		requirements: { level: 68, dex: 118 },
		baseStats: {
			minDamage: 54,
			maxDamage: 115,
			attackSpeed: 1.7,
			criticalChance: 6.5,
		},
		implicits: [
			{
				modifierId: "criticalStrikeMultiplierFlat",
				displayFormat: "+{value}% Critical Strike Multiplier",
				minValue: 52,
				maxValue: 94,
			},
		],
	},
	{
		id: "dagger_t18",		equipmentType: "weapon",
		weaponType: "dagger",
		dropLevel: 72,
		requirements: { level: 72, dex: 124 },
		baseStats: {
			minDamage: 57,
			maxDamage: 122,
			attackSpeed: 1.7,
			criticalChance: 6.5,
		},
		implicits: [
			{
				modifierId: "criticalStrikeMultiplierFlat",
				displayFormat: "+{value}% Critical Strike Multiplier",
				minValue: 54,
				maxValue: 98,
			},
		],
	},
	{
		id: "dagger_t19",		equipmentType: "weapon",
		weaponType: "dagger",
		dropLevel: 76,
		requirements: { level: 76, dex: 130 },
		baseStats: {
			minDamage: 60,
			maxDamage: 128,
			attackSpeed: 1.7,
			criticalChance: 6.5,
		},
		implicits: [
			{
				modifierId: "criticalStrikeMultiplierFlat",
				displayFormat: "+{value}% Critical Strike Multiplier",
				minValue: 56,
				maxValue: 102,
			},
		],
	},
	{
		id: "dagger_t20",		equipmentType: "weapon",
		weaponType: "dagger",
		dropLevel: 80,
		requirements: { level: 80, dex: 138 },
		baseStats: {
			minDamage: 63,
			maxDamage: 134,
			attackSpeed: 1.7,
			criticalChance: 6.5,
		},
		implicits: [
			{
				modifierId: "criticalStrikeMultiplierFlat",
				displayFormat: "+{value}% Critical Strike Multiplier",
				minValue: 58,
				maxValue: 106,
			},
		],
	},
	{
		id: "dagger_t21",		equipmentType: "weapon",
		weaponType: "dagger",
		dropLevel: 83,
		requirements: { level: 83, dex: 142 },
		baseStats: {
			minDamage: 66,
			maxDamage: 140,
			attackSpeed: 1.7,
			criticalChance: 6.5,
		},
		implicits: [
			{
				modifierId: "criticalStrikeMultiplierFlat",
				displayFormat: "+{value}% Critical Strike Multiplier",
				minValue: 60,
				maxValue: 110,
			},
		],
	},
];
