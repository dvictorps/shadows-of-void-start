import type { TemplateModifierId } from "../../lexicon/template-ids";
import type { EquipmentTemplate } from "./types";

// Barrier values mirror silk_shield_t* so a same-tier tome and silk shield
// contribute the same defensive footprint.
interface TomeTierSpec {
	tier: number;
	dropLevel: number;
	intReq: number;
	barrier: number;
	implicitMin: number;
	implicitMax: number;
}

// Tier-indexed modifier ids (tier N uses MODIFIERS[N - 1]). Mirrored against
// the EN display strings via lexicon/en.ts.
const TOME_MODIFIERS: readonly TemplateModifierId[] = [
	"apprentice",
	"acolyte",
	"initiate",
	"scholars",
	"adept",
	"magister",
	"mystic",
	"arcane",
	"sage",
	"oracle",
	"hierophant",
	"templar",
	"runed",
	"hallowed",
	"exalted",
	"archon",
	"sovereign",
	"eternal",
	"ascendant",
	"celestial",
	"void_inscribed",
];

const TOME_TIERS: TomeTierSpec[] = [
	{
		tier: 1,
		dropLevel: 1,
		intReq: 10,
		barrier: 12,
		implicitMin: 10,
		implicitMax: 15,
	},
	{
		tier: 2,
		dropLevel: 4,
		intReq: 14,
		barrier: 26,
		implicitMin: 11,
		implicitMax: 16,
	},
	{
		tier: 3,
		dropLevel: 7,
		intReq: 18,
		barrier: 38,
		implicitMin: 12,
		implicitMax: 17,
	},
	{
		tier: 4,
		dropLevel: 10,
		intReq: 22,
		barrier: 50,
		implicitMin: 13,
		implicitMax: 19,
	},
	{
		tier: 5,
		dropLevel: 14,
		intReq: 28,
		barrier: 65,
		implicitMin: 14,
		implicitMax: 20,
	},
	{
		tier: 6,
		dropLevel: 24,
		intReq: 44,
		barrier: 80,
		implicitMin: 15,
		implicitMax: 22,
	},
	{
		tier: 7,
		dropLevel: 28,
		intReq: 50,
		barrier: 97,
		implicitMin: 16,
		implicitMax: 23,
	},
	{
		tier: 8,
		dropLevel: 32,
		intReq: 58,
		barrier: 114,
		implicitMin: 17,
		implicitMax: 25,
	},
	{
		tier: 9,
		dropLevel: 36,
		intReq: 64,
		barrier: 131,
		implicitMin: 18,
		implicitMax: 26,
	},
	{
		tier: 10,
		dropLevel: 40,
		intReq: 70,
		barrier: 149,
		implicitMin: 19,
		implicitMax: 28,
	},
	{
		tier: 11,
		dropLevel: 44,
		intReq: 78,
		barrier: 168,
		implicitMin: 20,
		implicitMax: 29,
	},
	{
		tier: 12,
		dropLevel: 48,
		intReq: 84,
		barrier: 186,
		implicitMin: 21,
		implicitMax: 31,
	},
	{
		tier: 13,
		dropLevel: 52,
		intReq: 90,
		barrier: 205,
		implicitMin: 22,
		implicitMax: 32,
	},
	{
		tier: 14,
		dropLevel: 56,
		intReq: 98,
		barrier: 223,
		implicitMin: 23,
		implicitMax: 34,
	},
	{
		tier: 15,
		dropLevel: 60,
		intReq: 104,
		barrier: 241,
		implicitMin: 24,
		implicitMax: 35,
	},
	{
		tier: 16,
		dropLevel: 64,
		intReq: 110,
		barrier: 257,
		implicitMin: 25,
		implicitMax: 37,
	},
	{
		tier: 17,
		dropLevel: 68,
		intReq: 118,
		barrier: 274,
		implicitMin: 26,
		implicitMax: 38,
	},
	{
		tier: 18,
		dropLevel: 72,
		intReq: 124,
		barrier: 289,
		implicitMin: 27,
		implicitMax: 39,
	},
	{
		tier: 19,
		dropLevel: 76,
		intReq: 130,
		barrier: 301,
		implicitMin: 28,
		implicitMax: 39,
	},
	{
		tier: 20,
		dropLevel: 80,
		intReq: 138,
		barrier: 308,
		implicitMin: 29,
		implicitMax: 40,
	},
	{
		tier: 21,
		dropLevel: 83,
		intReq: 142,
		barrier: 308,
		implicitMin: 30,
		implicitMax: 40,
	},
];

export const TOME_TEMPLATES: EquipmentTemplate[] = TOME_TIERS.map((t) => ({
	id: `tome_t${t.tier}`,
	nameBase: "tome",
	nameModifier: TOME_MODIFIERS[t.tier - 1],
	equipmentType: "tome",
	armorType: "silk",
	dropLevel: t.dropLevel,
	requirements: { level: t.dropLevel, int: t.intReq },
	baseStats: { barrier: t.barrier },
	implicits: [
		{
			modifierId: "globalSpellDamageIncrease",
			displayFormat: "+{value}% increased Spell Damage",
			minValue: t.implicitMin,
			maxValue: t.implicitMax,
		},
	],
	icon: "/assets/sprites/escudos-offhands/tomoMagico.png",
}));
