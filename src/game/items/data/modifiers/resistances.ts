import type { Modifier } from "../../types"
import { createStandardTiers } from "../../types"

export const RESISTANCE_MODIFIERS: Record<string, Modifier> = {
	coldResistance: {
		id: "coldResistance",
		name: "of Frost Resistance",
		affixType: "suffix",
		modifierType: "flat",
		category: "defensive",
		applicableTo: ["helmet", "chestplate", "leggings", "boots", "gloves", "ring", "amulet", "belt"],
		displayFormat: "+{value}% Cold Resistance",
		tiers: createStandardTiers(5, 10, 51, 55),
	},
	fireResistance: {
		id: "fireResistance",
		name: "of Flame Resistance",
		affixType: "suffix",
		modifierType: "flat",
		category: "defensive",
		applicableTo: ["helmet", "chestplate", "leggings", "boots", "gloves", "ring", "amulet", "belt"],
		displayFormat: "+{value}% Fire Resistance",
		tiers: createStandardTiers(5, 10, 51, 55),
	},
	lightningResistance: {
		id: "lightningResistance",
		name: "of Storm Resistance",
		affixType: "suffix",
		modifierType: "flat",
		category: "defensive",
		applicableTo: ["helmet", "chestplate", "leggings", "boots", "gloves", "ring", "amulet", "belt"],
		displayFormat: "+{value}% Lightning Resistance",
		tiers: createStandardTiers(5, 10, 51, 55),
	},
	voidResistance: {
		id: "voidResistance",
		name: "of Void Resistance",
		affixType: "suffix",
		modifierType: "flat",
		category: "defensive",
		applicableTo: ["helmet", "chestplate", "leggings", "boots", "gloves", "ring", "amulet", "belt"],
		displayFormat: "+{value}% Void Resistance",
		tiers: createStandardTiers(5, 10, 51, 55),
	},
}
