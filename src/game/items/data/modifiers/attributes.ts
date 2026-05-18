import type { Modifier } from "../../types";
import { createStandardTiers } from "../../types";

export const ATTRIBUTE_MODIFIERS: Record<string, Modifier> = {
	strengthFlat: {
		id: "strengthFlat",
		name: "of Strength",
		affixType: "suffix",
		modifierType: "flat",
		category: "attribute",
		applicableTo: ["weapon", "offhand", "allArmor", "allJewelry"],
		displayFormat: "+{value} Strength",
		isGlobalStat: true,
		tags: ["attribute"],
		tiers: createStandardTiers(8, 12, 48, 50),
	},
	dexterityFlat: {
		id: "dexterityFlat",
		name: "of Dexterity",
		affixType: "suffix",
		modifierType: "flat",
		category: "attribute",
		applicableTo: ["weapon", "offhand", "allArmor", "allJewelry"],
		displayFormat: "+{value} Dexterity",
		isGlobalStat: true,
		tags: ["attribute"],
		tiers: createStandardTiers(8, 12, 48, 50),
	},
	intelligenceFlat: {
		id: "intelligenceFlat",
		name: "of Intelligence",
		affixType: "suffix",
		modifierType: "flat",
		category: "attribute",
		applicableTo: ["weapon", "offhand", "allArmor", "allJewelry"],
		displayFormat: "+{value} Intelligence",
		isGlobalStat: true,
		tags: ["attribute"],
		tiers: createStandardTiers(8, 12, 48, 50),
	},
	// Implicit-only — applies to STR + DEX + INT. `applicableTo: []` keeps it
	// out of the random explicit pool; the engine still recognises the id when
	// applied via template implicits (e.g., prismatic belt, amulets).
	allAttributesFlat: {
		id: "allAttributesFlat",
		name: "of All Attributes",
		affixType: "suffix",
		modifierType: "flat",
		category: "attribute",
		applicableTo: [],
		displayFormat: "+{value} to all Attributes",
		isGlobalStat: true,
		tags: ["attribute"],
		tiers: createStandardTiers(4, 6, 20, 25),
	},
};
