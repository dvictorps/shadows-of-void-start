import type { Modifier } from "../../types"
import { createStandardTiers } from "../../types"

export const SPELL_DAMAGE_MODIFIERS: Record<string, Modifier> = {
	coldDamageFlat: {
		id: "coldDamageFlat",
		name: "Frosty",
		affixType: "prefix",
		modifierType: "flat",
		category: "offensive",
		applicableTo: ["staff", "wand"],
		displayFormat: "+{value} Cold Damage to Spells",
		tiers: createStandardTiers(1, 2, 18, 28),
	},
	fireDamageFlat: {
		id: "fireDamageFlat",
		name: "Burning",
		affixType: "prefix",
		modifierType: "flat",
		category: "offensive",
		applicableTo: ["staff", "wand"],
		displayFormat: "+{value} Fire Damage to Spells",
		tiers: createStandardTiers(1, 2, 18, 28),
	},
	lightningDamageFlat: {
		id: "lightningDamageFlat",
		name: "Shocking",
		affixType: "prefix",
		modifierType: "flat",
		category: "offensive",
		applicableTo: ["staff", "wand"],
		displayFormat: "+{value} Lightning Damage to Spells",
		tiers: createStandardTiers(1, 3, 35, 40),
	},
	voidDamageFlat: {
		id: "voidDamageFlat",
		name: "Voidtouched",
		affixType: "prefix",
		modifierType: "flat",
		category: "offensive",
		applicableTo: ["staff", "wand"],
		displayFormat: "+{value} Void Damage to Spells",
		tiers: createStandardTiers(1, 2, 18, 28),
	},
}
