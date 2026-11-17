import type { ArmorType, ModifierApplicableTo } from "./base";

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

export interface ModifierTier {
	tier: number;
	minItemLevel: number;
	maxItemLevel: number;
	valueRange: readonly [number, number];
}

export type LocalStatTarget =
	| "physicalDamage"
	| "attackSpeed"
	| "criticalChance"
	| "elementalDamage"
	| "defense"
	| "blockChance";

export interface StatEffect {
	target: LocalStatTarget;
	operation: "flat" | "increased";
	element?: string;
}

export interface Modifier {
	id: string;
	affixType: AffixType;
	modifierType: ModifierTypeId;
	category: ModifierCategory;
	applicableTo: ModifierApplicableTo[];
	displayFormat: string;
	isGlobalStat?: boolean;
	statEffect?: StatEffect;
	weight?: number;
	tags?: string[];
	restrictedToArmorType?: ArmorType;
	restrictedToImplicitMod?: string;
	tiers: ModifierTier[];
}

export const DEFAULT_MODIFIER_WEIGHT = 1000;

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
