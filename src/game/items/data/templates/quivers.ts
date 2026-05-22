import type { TemplateModifierId } from "../../lexicon/template-ids";
import type { EquipmentTemplate } from "./types";

// Bow-bound: enforced at equip-time and via broken-state in the stat engine.
// See CONTEXT.md → "Bow + Quiver".
interface QuiverTierSpec {
	tier: number;
	dropLevel: number;
	dexReq: number;
	implicitMin: number;
	implicitMax: number;
}

const QUIVER_MODIFIERS: readonly TemplateModifierId[] = [
	"hide",
	"tanned",
	"hunters",
	"rangers",
	"skirmisher",
	"scouts",
	"marksman",
	"treated",
	"warden",
	"champion",
	"templar",
	"relic",
	"runed",
	"hallowed",
	"exalted",
	"archon",
	"sovereign",
	"eternal",
	"ascendant",
	"celestial",
	"void_touched",
];

const QUIVER_TIERS: QuiverTierSpec[] = [
	{
		tier: 1,
		dropLevel: 1,
		dexReq: 10,
		implicitMin: 3,
		implicitMax: 5,
	},
	{
		tier: 2,
		dropLevel: 4,
		dexReq: 14,
		implicitMin: 3,
		implicitMax: 5,
	},
	{
		tier: 3,
		dropLevel: 7,
		dexReq: 18,
		implicitMin: 4,
		implicitMax: 6,
	},
	{
		tier: 4,
		dropLevel: 10,
		dexReq: 22,
		implicitMin: 4,
		implicitMax: 6,
	},
	{
		tier: 5,
		dropLevel: 14,
		dexReq: 28,
		implicitMin: 4,
		implicitMax: 7,
	},
	{
		tier: 6,
		dropLevel: 24,
		dexReq: 44,
		implicitMin: 5,
		implicitMax: 7,
	},
	{
		tier: 7,
		dropLevel: 28,
		dexReq: 50,
		implicitMin: 5,
		implicitMax: 8,
	},
	{
		tier: 8,
		dropLevel: 32,
		dexReq: 58,
		implicitMin: 6,
		implicitMax: 8,
	},
	{
		tier: 9,
		dropLevel: 36,
		dexReq: 64,
		implicitMin: 6,
		implicitMax: 9,
	},
	{
		tier: 10,
		dropLevel: 40,
		dexReq: 70,
		implicitMin: 6,
		implicitMax: 10,
	},
	{
		tier: 11,
		dropLevel: 44,
		dexReq: 78,
		implicitMin: 7,
		implicitMax: 10,
	},
	{
		tier: 12,
		dropLevel: 48,
		dexReq: 84,
		implicitMin: 7,
		implicitMax: 11,
	},
	{
		tier: 13,
		dropLevel: 52,
		dexReq: 90,
		implicitMin: 8,
		implicitMax: 11,
	},
	{
		tier: 14,
		dropLevel: 56,
		dexReq: 98,
		implicitMin: 8,
		implicitMax: 12,
	},
	{
		tier: 15,
		dropLevel: 60,
		dexReq: 104,
		implicitMin: 8,
		implicitMax: 12,
	},
	{
		tier: 16,
		dropLevel: 64,
		dexReq: 110,
		implicitMin: 9,
		implicitMax: 13,
	},
	{
		tier: 17,
		dropLevel: 68,
		dexReq: 118,
		implicitMin: 9,
		implicitMax: 13,
	},
	{
		tier: 18,
		dropLevel: 72,
		dexReq: 124,
		implicitMin: 9,
		implicitMax: 14,
	},
	{
		tier: 19,
		dropLevel: 76,
		dexReq: 130,
		implicitMin: 10,
		implicitMax: 14,
	},
	{
		tier: 20,
		dropLevel: 80,
		dexReq: 138,
		implicitMin: 10,
		implicitMax: 15,
	},
	{
		tier: 21,
		dropLevel: 83,
		dexReq: 142,
		implicitMin: 10,
		implicitMax: 15,
	},
];

export const QUIVER_TEMPLATES: EquipmentTemplate[] = QUIVER_TIERS.map((t) => ({
	id: `quiver_t${t.tier}`,
	nameBase: "quiver",
	nameModifier: QUIVER_MODIFIERS[t.tier - 1],
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
