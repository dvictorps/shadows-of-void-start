import type { Modifier } from "../../types";
import { createStandardTiers } from "../../types";

export const MAGIC_FIND_MODIFIERS: Record<string, Modifier> = {
	itemRarityIncreasePrefix: {
		id: "itemRarityIncreasePrefix",		affixType: "prefix",
		modifierType: "increased",
		category: "utility",
		applicableTo: [
			"helmet",
			"chestplate",
			"boots",
			"gloves",
			"offhand",
			"tome",
			"quiver",
			"allJewelry",
		],
		displayFormat: "+{value}% Item Rarity",
		isGlobalStat: true,
		tiers: createStandardTiers(5, 10, 41, 50),
	},
	itemRarityIncreaseSuffix: {
		id: "itemRarityIncreaseSuffix",		affixType: "suffix",
		modifierType: "increased",
		category: "utility",
		applicableTo: [
			"helmet",
			"chestplate",
			"boots",
			"gloves",
			"offhand",
			"tome",
			"quiver",
			"allJewelry",
		],
		displayFormat: "+{value}% Item Rarity",
		isGlobalStat: true,
		tiers: createStandardTiers(5, 10, 41, 50),
	},
};
