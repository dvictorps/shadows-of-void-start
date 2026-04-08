import type { ModifierApplicableTo } from "./base";

// ── Modifier value types (how the value is applied) ──

export const MODIFIER_TYPES = {
	flat: { id: "flat", name: "Flat", description: "Adds a flat value" },
	increased: {
		id: "increased",
		name: "Increased",
		description: "Percentage increase (additive)",
	},
	more: {
		id: "more",
		name: "More",
		description: "Percentage multiplier (multiplicative)",
	},
} as const;

export type ModifierTypeId = keyof typeof MODIFIER_TYPES;
export type ModifierCategory =
	| "offensive"
	| "defensive"
	| "attribute"
	| "utility";
export type AffixType = "prefix" | "suffix";

// ── Tier definition ──

export interface ModifierTier {
	tier: number;
	minItemLevel: number;
	maxItemLevel: number;
	valueRange: readonly [number, number];
}

// ── Declarative stat effect (how local mods affect the item header) ──

export type LocalStatTarget =
	| "physicalDamage" // maps to minDamage + maxDamage
	| "attackSpeed"
	| "criticalChance"
	| "elementalDamage" // requires element field
	| "defense" // resolved to armor/evasion/barrier based on armorType
	| "blockChance"; // shields only — multiplies base block chance

export interface StatEffect {
	target: LocalStatTarget;
	operation: "flat" | "increased";
	element?: string; // only for elementalDamage target (e.g. "Cold", "Fire")
}

// ── Modifier definition ──

export interface Modifier {
	id: string;
	name: string;
	affixType: AffixType;
	modifierType: ModifierTypeId;
	category: ModifierCategory;
	applicableTo: ModifierApplicableTo[];
	displayFormat: string;
	isGlobalStat?: boolean;
	statEffect?: StatEffect;
	weight?: number; // default DEFAULT_MODIFIER_WEIGHT. Higher = more common.
	tags?: string[]; // synergy tags (e.g. ["cold", "spell"]) — used for intelligent generation
	tiers: ModifierTier[];
}

export const DEFAULT_MODIFIER_WEIGHT = 1000;

// ── Tier factory helpers ──

export function createStandardTiers(
	tier10Min: number,
	tier10Max: number,
	tier1Min: number,
	tier1Max: number,
): ModifierTier[] {
	const tiers: ModifierTier[] = [];

	for (let i = 0; i < 10; i++) {
		const tier = 10 - i;
		const progress = i / 9;

		const minValue = tier10Min + (tier1Min - tier10Min) * progress;
		const maxValue = tier10Max + (tier1Max - tier10Max) * progress;

		tiers.push({
			tier,
			minItemLevel: i * 10 + 1,
			maxItemLevel: (i + 1) * 10,
			valueRange: [Math.round(minValue), Math.round(maxValue)],
		});
	}

	return tiers;
}
