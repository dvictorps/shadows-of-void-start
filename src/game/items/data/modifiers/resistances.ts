import type { Modifier } from "../../types";
import { createStandardTiers } from "../../types";

export const RESISTANCE_MODIFIERS: Record<string, Modifier> = {
	coldResistance: {
		id: "coldResistance",
		affixType: "suffix",
		modifierType: "flat",
		category: "defensive",
		applicableTo: ["allArmor", "allJewelry", "tome", "quiver"],
		displayFormat: "+{value}% Cold Resistance",
		isGlobalStat: true,
		tags: ["resistance", "cold"],
		tiers: createStandardTiers(8, 12, 48, 50),
	},
	fireResistance: {
		id: "fireResistance",
		affixType: "suffix",
		modifierType: "flat",
		category: "defensive",
		applicableTo: ["allArmor", "allJewelry", "tome", "quiver"],
		displayFormat: "+{value}% Fire Resistance",
		isGlobalStat: true,
		tags: ["resistance", "fire"],
		tiers: createStandardTiers(8, 12, 48, 50),
	},
	lightningResistance: {
		id: "lightningResistance",
		affixType: "suffix",
		modifierType: "flat",
		category: "defensive",
		applicableTo: ["allArmor", "allJewelry", "tome", "quiver"],
		displayFormat: "+{value}% Lightning Resistance",
		isGlobalStat: true,
		tags: ["resistance", "lightning"],
		tiers: createStandardTiers(8, 12, 48, 50),
	},
	voidResistance: {
		id: "voidResistance",
		affixType: "suffix",
		modifierType: "flat",
		category: "defensive",
		applicableTo: ["allArmor", "allJewelry", "tome", "quiver"],
		displayFormat: "+{value}% Void Resistance",
		isGlobalStat: true,
		tags: ["resistance", "void"],
		tiers: createStandardTiers(8, 12, 48, 50),
	},
};
