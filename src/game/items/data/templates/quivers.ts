import type { EquipmentTemplate } from "./types";

// Bow-bound: enforced at equip-time and via broken-state in the stat engine.
// See CONTEXT.md → "Bow + Quiver".
interface QuiverTierSpec {
	tier: number;
	dropLevel: number;
	dexReq: number;
	implicitMin: number;
	implicitMax: number;
	name: string;
}

const QUIVER_TIERS: QuiverTierSpec[] = [
	{
		tier: 1,
		dropLevel: 1,
		dexReq: 10,
		implicitMin: 3,
		implicitMax: 5,
		name: "Hide Quiver",
	},
	{
		tier: 2,
		dropLevel: 8,
		dexReq: 18,
		implicitMin: 3,
		implicitMax: 5,
		name: "Tanned Quiver",
	},
	{
		tier: 3,
		dropLevel: 12,
		dexReq: 24,
		implicitMin: 4,
		implicitMax: 6,
		name: "Hunter's Quiver",
	},
	{
		tier: 4,
		dropLevel: 16,
		dexReq: 30,
		implicitMin: 4,
		implicitMax: 6,
		name: "Ranger's Quiver",
	},
	{
		tier: 5,
		dropLevel: 20,
		dexReq: 38,
		implicitMin: 4,
		implicitMax: 7,
		name: "Skirmisher Quiver",
	},
	{
		tier: 6,
		dropLevel: 24,
		dexReq: 44,
		implicitMin: 5,
		implicitMax: 7,
		name: "Scout's Quiver",
	},
	{
		tier: 7,
		dropLevel: 28,
		dexReq: 50,
		implicitMin: 5,
		implicitMax: 8,
		name: "Marksman Quiver",
	},
	{
		tier: 8,
		dropLevel: 32,
		dexReq: 58,
		implicitMin: 6,
		implicitMax: 8,
		name: "Treated Quiver",
	},
	{
		tier: 9,
		dropLevel: 36,
		dexReq: 64,
		implicitMin: 6,
		implicitMax: 9,
		name: "Warden Quiver",
	},
	{
		tier: 10,
		dropLevel: 40,
		dexReq: 70,
		implicitMin: 6,
		implicitMax: 10,
		name: "Champion Quiver",
	},
	{
		tier: 11,
		dropLevel: 44,
		dexReq: 78,
		implicitMin: 7,
		implicitMax: 10,
		name: "Templar Quiver",
	},
	{
		tier: 12,
		dropLevel: 48,
		dexReq: 84,
		implicitMin: 7,
		implicitMax: 11,
		name: "Relic Quiver",
	},
	{
		tier: 13,
		dropLevel: 52,
		dexReq: 90,
		implicitMin: 8,
		implicitMax: 11,
		name: "Runed Quiver",
	},
	{
		tier: 14,
		dropLevel: 56,
		dexReq: 98,
		implicitMin: 8,
		implicitMax: 12,
		name: "Hallowed Quiver",
	},
	{
		tier: 15,
		dropLevel: 60,
		dexReq: 104,
		implicitMin: 8,
		implicitMax: 12,
		name: "Exalted Quiver",
	},
	{
		tier: 16,
		dropLevel: 64,
		dexReq: 110,
		implicitMin: 9,
		implicitMax: 13,
		name: "Archon Quiver",
	},
	{
		tier: 17,
		dropLevel: 68,
		dexReq: 118,
		implicitMin: 9,
		implicitMax: 13,
		name: "Sovereign Quiver",
	},
	{
		tier: 18,
		dropLevel: 72,
		dexReq: 124,
		implicitMin: 9,
		implicitMax: 14,
		name: "Eternal Quiver",
	},
	{
		tier: 19,
		dropLevel: 76,
		dexReq: 130,
		implicitMin: 10,
		implicitMax: 14,
		name: "Ascendant Quiver",
	},
	{
		tier: 20,
		dropLevel: 80,
		dexReq: 138,
		implicitMin: 10,
		implicitMax: 15,
		name: "Celestial Quiver",
	},
	{
		tier: 21,
		dropLevel: 83,
		dexReq: 142,
		implicitMin: 10,
		implicitMax: 15,
		name: "Void-Touched Quiver",
	},
];

export const QUIVER_TEMPLATES: EquipmentTemplate[] = QUIVER_TIERS.map((t) => ({
	id: `quiver_t${t.tier}`,
	name: t.name,
	equipmentType: "quiver",
	dropLevel: t.dropLevel,
	requirements: { level: t.dropLevel, dex: t.dexReq },
	baseStats: {},
	implicits: [
		{
			modifierId: "globalAttackSpeedIncrease",
			displayFormat: "+{value}% increased Attack Speed",
			minValue: t.implicitMin,
			maxValue: t.implicitMax,
		},
	],
	icon: "/assets/sprites/escudos-offhands/aljava.png",
}));
