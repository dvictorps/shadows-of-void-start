import type { Modifier } from "../../types"
import { createStandardTiers } from "../../types"

export const ATTRIBUTE_MODIFIERS: Record<string, Modifier> = {
	strengthFlat: {
		id: "strengthFlat",
		name: "of Strength",
		affixType: "suffix",
		modifierType: "flat",
		category: "attribute",
		applicableTo: ["weapon", "offhand", "allArmor", "allJewelry"],
		displayFormat: "+{value} Strength",
		tiers: createStandardTiers(5, 10, 51, 55),
	},
	dexterityFlat: {
		id: "dexterityFlat",
		name: "of Dexterity",
		affixType: "suffix",
		modifierType: "flat",
		category: "attribute",
		applicableTo: ["weapon", "offhand", "allArmor", "allJewelry"],
		displayFormat: "+{value} Dexterity",
		tiers: createStandardTiers(5, 10, 51, 55),
	},
	intelligenceFlat: {
		id: "intelligenceFlat",
		name: "of Intelligence",
		affixType: "suffix",
		modifierType: "flat",
		category: "attribute",
		applicableTo: ["weapon", "offhand", "allArmor", "allJewelry"],
		displayFormat: "+{value} Intelligence",
		tiers: createStandardTiers(5, 10, 51, 55),
	},
}
