import type { EquipmentTemplate } from "./types";

// Swords (1H, str+dex hybrid) — AtkSpd: 1.50, Crit: 5.0, Implicit: +{value} Accuracy Rating
export const SWORD_TEMPLATES: EquipmentTemplate[] = [
	{
		id: "sword_t1",
		name: "Iron Sword",
		equipmentType: "weapon",
		weaponType: "sword",
		dropLevel: 1,
		requirements: { level: 1, str: 10, dex: 10 },
		baseStats: {
			minDamage: 12,
			maxDamage: 28,
			attackSpeed: 1.5,
			criticalChance: 5,
		},
		implicits: [
			{
				displayFormat: "+{value} Accuracy Rating",
				minValue: 60,
				maxValue: 100,
			},
		],
	},
	{
		id: "sword_t2",
		name: "Copper Blade",
		equipmentType: "weapon",
		weaponType: "sword",
		dropLevel: 8,
		requirements: { level: 8, str: 16, dex: 16 },
		baseStats: {
			minDamage: 16,
			maxDamage: 35,
			attackSpeed: 1.5,
			criticalChance: 5,
		},
		implicits: [
			{
				displayFormat: "+{value} Accuracy Rating",
				minValue: 80,
				maxValue: 120,
			},
		],
	},
	{
		id: "sword_t3",
		name: "Bronze Falchion",
		equipmentType: "weapon",
		weaponType: "sword",
		dropLevel: 12,
		requirements: { level: 12, str: 21, dex: 21 },
		baseStats: {
			minDamage: 19,
			maxDamage: 42,
			attackSpeed: 1.5,
			criticalChance: 5,
		},
		implicits: [
			{
				displayFormat: "+{value} Accuracy Rating",
				minValue: 95,
				maxValue: 140,
			},
		],
	},
	{
		id: "sword_t4",
		name: "Steel Sword",
		equipmentType: "weapon",
		weaponType: "sword",
		dropLevel: 16,
		requirements: { level: 16, str: 26, dex: 26 },
		baseStats: {
			minDamage: 22,
			maxDamage: 50,
			attackSpeed: 1.5,
			criticalChance: 5,
		},
		implicits: [
			{
				displayFormat: "+{value} Accuracy Rating",
				minValue: 110,
				maxValue: 160,
			},
		],
	},
	{
		id: "sword_t5",
		name: "War Blade",
		equipmentType: "weapon",
		weaponType: "sword",
		dropLevel: 20,
		requirements: { level: 20, str: 32, dex: 32 },
		baseStats: {
			minDamage: 26,
			maxDamage: 58,
			attackSpeed: 1.5,
			criticalChance: 5,
		},
		implicits: [
			{
				displayFormat: "+{value} Accuracy Rating",
				minValue: 130,
				maxValue: 180,
			},
		],
	},
	{
		id: "sword_t6",
		name: "Soldier's Sabre",
		equipmentType: "weapon",
		weaponType: "sword",
		dropLevel: 24,
		requirements: { level: 24, str: 37, dex: 37 },
		baseStats: {
			minDamage: 30,
			maxDamage: 66,
			attackSpeed: 1.5,
			criticalChance: 5,
		},
		implicits: [
			{
				displayFormat: "+{value} Accuracy Rating",
				minValue: 150,
				maxValue: 200,
			},
		],
	},
	{
		id: "sword_t7",
		name: "Knight's Edge",
		equipmentType: "weapon",
		weaponType: "sword",
		dropLevel: 28,
		requirements: { level: 28, str: 42, dex: 42 },
		baseStats: {
			minDamage: 34,
			maxDamage: 74,
			attackSpeed: 1.5,
			criticalChance: 5,
		},
		implicits: [
			{
				displayFormat: "+{value} Accuracy Rating",
				minValue: 170,
				maxValue: 220,
			},
		],
	},
	{
		id: "sword_t8",
		name: "Damascus Blade",
		equipmentType: "weapon",
		weaponType: "sword",
		dropLevel: 32,
		requirements: { level: 32, str: 48, dex: 48 },
		baseStats: {
			minDamage: 38,
			maxDamage: 83,
			attackSpeed: 1.5,
			criticalChance: 5,
		},
		implicits: [
			{
				displayFormat: "+{value} Accuracy Rating",
				minValue: 190,
				maxValue: 245,
			},
		],
	},
	{
		id: "sword_t9",
		name: "Warden Sword",
		equipmentType: "weapon",
		weaponType: "sword",
		dropLevel: 36,
		requirements: { level: 36, str: 53, dex: 53 },
		baseStats: {
			minDamage: 42,
			maxDamage: 92,
			attackSpeed: 1.5,
			criticalChance: 5,
		},
		implicits: [
			{
				displayFormat: "+{value} Accuracy Rating",
				minValue: 210,
				maxValue: 270,
			},
		],
	},
	{
		id: "sword_t10",
		name: "Champion Sabre",
		equipmentType: "weapon",
		weaponType: "sword",
		dropLevel: 40,
		requirements: { level: 40, str: 58, dex: 58 },
		baseStats: {
			minDamage: 46,
			maxDamage: 100,
			attackSpeed: 1.5,
			criticalChance: 5,
		},
		implicits: [
			{
				displayFormat: "+{value} Accuracy Rating",
				minValue: 230,
				maxValue: 295,
			},
		],
	},
	{
		id: "sword_t11",
		name: "Templar Blade",
		equipmentType: "weapon",
		weaponType: "sword",
		dropLevel: 44,
		requirements: { level: 44, str: 64, dex: 64 },
		baseStats: {
			minDamage: 51,
			maxDamage: 110,
			attackSpeed: 1.5,
			criticalChance: 5,
		},
		implicits: [
			{
				displayFormat: "+{value} Accuracy Rating",
				minValue: 255,
				maxValue: 320,
			},
		],
	},
	{
		id: "sword_t12",
		name: "Relic Sword",
		equipmentType: "weapon",
		weaponType: "sword",
		dropLevel: 48,
		requirements: { level: 48, str: 69, dex: 69 },
		baseStats: {
			minDamage: 55,
			maxDamage: 120,
			attackSpeed: 1.5,
			criticalChance: 5,
		},
		implicits: [
			{
				displayFormat: "+{value} Accuracy Rating",
				minValue: 280,
				maxValue: 345,
			},
		],
	},
	{
		id: "sword_t13",
		name: "Runed Falchion",
		equipmentType: "weapon",
		weaponType: "sword",
		dropLevel: 52,
		requirements: { level: 52, str: 74, dex: 74 },
		baseStats: {
			minDamage: 60,
			maxDamage: 130,
			attackSpeed: 1.5,
			criticalChance: 5,
		},
		implicits: [
			{
				displayFormat: "+{value} Accuracy Rating",
				minValue: 300,
				maxValue: 370,
			},
		],
	},
	{
		id: "sword_t14",
		name: "Hallowed Edge",
		equipmentType: "weapon",
		weaponType: "sword",
		dropLevel: 56,
		requirements: { level: 56, str: 80, dex: 80 },
		baseStats: {
			minDamage: 65,
			maxDamage: 140,
			attackSpeed: 1.5,
			criticalChance: 5,
		},
		implicits: [
			{
				displayFormat: "+{value} Accuracy Rating",
				minValue: 325,
				maxValue: 395,
			},
		],
	},
	{
		id: "sword_t15",
		name: "Exalted Sabre",
		equipmentType: "weapon",
		weaponType: "sword",
		dropLevel: 60,
		requirements: { level: 60, str: 85, dex: 85 },
		baseStats: {
			minDamage: 70,
			maxDamage: 150,
			attackSpeed: 1.5,
			criticalChance: 5,
		},
		implicits: [
			{
				displayFormat: "+{value} Accuracy Rating",
				minValue: 350,
				maxValue: 420,
			},
		],
	},
	{
		id: "sword_t16",
		name: "Archon Blade",
		equipmentType: "weapon",
		weaponType: "sword",
		dropLevel: 64,
		requirements: { level: 64, str: 90, dex: 90 },
		baseStats: {
			minDamage: 74,
			maxDamage: 158,
			attackSpeed: 1.5,
			criticalChance: 5,
		},
		implicits: [
			{
				displayFormat: "+{value} Accuracy Rating",
				minValue: 370,
				maxValue: 445,
			},
		],
	},
	{
		id: "sword_t17",
		name: "Sovereign Sword",
		equipmentType: "weapon",
		weaponType: "sword",
		dropLevel: 68,
		requirements: { level: 68, str: 96, dex: 96 },
		baseStats: {
			minDamage: 78,
			maxDamage: 165,
			attackSpeed: 1.5,
			criticalChance: 5,
		},
		implicits: [
			{
				displayFormat: "+{value} Accuracy Rating",
				minValue: 390,
				maxValue: 470,
			},
		],
	},
	{
		id: "sword_t18",
		name: "Eternal Falchion",
		equipmentType: "weapon",
		weaponType: "sword",
		dropLevel: 72,
		requirements: { level: 72, str: 101, dex: 101 },
		baseStats: {
			minDamage: 82,
			maxDamage: 173,
			attackSpeed: 1.5,
			criticalChance: 5,
		},
		implicits: [
			{
				displayFormat: "+{value} Accuracy Rating",
				minValue: 415,
				maxValue: 495,
			},
		],
	},
	{
		id: "sword_t19",
		name: "Ascendant Edge",
		equipmentType: "weapon",
		weaponType: "sword",
		dropLevel: 76,
		requirements: { level: 76, str: 106, dex: 106 },
		baseStats: {
			minDamage: 86,
			maxDamage: 180,
			attackSpeed: 1.5,
			criticalChance: 5,
		},
		implicits: [
			{
				displayFormat: "+{value} Accuracy Rating",
				minValue: 440,
				maxValue: 520,
			},
		],
	},
	{
		id: "sword_t20",
		name: "Celestial Sabre",
		equipmentType: "weapon",
		weaponType: "sword",
		dropLevel: 80,
		requirements: { level: 80, str: 112, dex: 112 },
		baseStats: {
			minDamage: 90,
			maxDamage: 188,
			attackSpeed: 1.5,
			criticalChance: 5,
		},
		implicits: [
			{
				displayFormat: "+{value} Accuracy Rating",
				minValue: 460,
				maxValue: 545,
			},
		],
	},
	{
		id: "sword_t21",
		name: "Void-Touched Sabre",
		equipmentType: "weapon",
		weaponType: "sword",
		dropLevel: 83,
		requirements: { level: 83, str: 116, dex: 116 },
		baseStats: {
			minDamage: 95,
			maxDamage: 195,
			attackSpeed: 1.5,
			criticalChance: 5,
		},
		implicits: [
			{
				displayFormat: "+{value} Accuracy Rating",
				minValue: 480,
				maxValue: 570,
			},
		],
	},
];
