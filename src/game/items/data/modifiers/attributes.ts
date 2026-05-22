import type { Modifier } from "../../types";
import { createStandardTiers } from "../../types";

export const ATTRIBUTE_MODIFIERS: Record<string, Modifier> = {
	strengthFlat: {
		id: "strengthFlat",		affixType: "suffix",
		modifierType: "flat",
		category: "attribute",
		applicableTo: ["weapon", "offhand", "allArmor", "allJewelry"],
		displayFormat: "+{value} Strength",
		isGlobalStat: true,
		tags: ["attribute"],
		tiers: createStandardTiers(8, 12, 48, 50),
	},
	dexterityFlat: {
		id: "dexterityFlat",		affixType: "suffix",
		modifierType: "flat",
		category: "attribute",
		applicableTo: ["weapon", "offhand", "allArmor", "allJewelry", "quiver"],
		displayFormat: "+{value} Dexterity",
		isGlobalStat: true,
		tags: ["attribute"],
		tiers: createStandardTiers(8, 12, 48, 50),
	},
	intelligenceFlat: {
		id: "intelligenceFlat",		affixType: "suffix",
		modifierType: "flat",
		category: "attribute",
		applicableTo: ["weapon", "offhand", "allArmor", "allJewelry", "tome"],
		displayFormat: "+{value} Intelligence",
		isGlobalStat: true,
		tags: ["attribute"],
		tiers: createStandardTiers(8, 12, 48, 50),
	},
	// Implicit-only — applies to STR + DEX + INT. `applicableTo: []` keeps it
	// out of the random explicit pool; the engine still recognises the id when
	// applied via template implicits (e.g., prismatic belt, amulets).
	allAttributesFlat: {
		id: "allAttributesFlat",		affixType: "suffix",
		modifierType: "flat",
		category: "attribute",
		applicableTo: [],
		displayFormat: "+{value} to all Attributes",
		isGlobalStat: true,
		tags: ["attribute"],
		tiers: createStandardTiers(4, 6, 20, 25),
	},
};
