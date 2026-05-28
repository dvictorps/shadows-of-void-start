import type { Modifier } from "../../types";
import { createStandardTiers } from "../../types";

// Mage-flavor family: tomes, amulets, silk gloves, staves (ADR 0007).
export const TOME_MODIFIERS: Record<string, Modifier> = {
	tomeGainAsExtraCold: {
		id: "tomeGainAsExtraCold",
		affixType: "prefix",
		modifierType: "flat",
		category: "offensive",
		applicableTo: ["tome", "amulet", "gloves", "staff"],
		restrictedToArmorType: "silk",
		displayFormat: "Gain {value}% of Spell Damage as Extra Cold Damage",
		isGlobalStat: true,
		tags: ["cold", "elemental", "spell"],
		tiers: createStandardTiers(1, 3, 12, 18),
	},
	tomeGainAsExtraFire: {
		id: "tomeGainAsExtraFire",
		affixType: "prefix",
		modifierType: "flat",
		category: "offensive",
		applicableTo: ["tome", "amulet", "gloves", "staff"],
		restrictedToArmorType: "silk",
		displayFormat: "Gain {value}% of Spell Damage as Extra Fire Damage",
		isGlobalStat: true,
		tags: ["fire", "elemental", "spell"],
		tiers: createStandardTiers(1, 3, 12, 18),
	},
	tomeGainAsExtraLightning: {
		id: "tomeGainAsExtraLightning",
		affixType: "prefix",
		modifierType: "flat",
		category: "offensive",
		applicableTo: ["tome", "amulet", "gloves", "staff"],
		restrictedToArmorType: "silk",
		displayFormat: "Gain {value}% of Spell Damage as Extra Lightning Damage",
		isGlobalStat: true,
		tags: ["lightning", "elemental", "spell"],
		tiers: createStandardTiers(1, 3, 12, 18),
	},
	tomeGainAsExtraVoid: {
		id: "tomeGainAsExtraVoid",
		affixType: "prefix",
		modifierType: "flat",
		category: "offensive",
		applicableTo: ["tome", "amulet", "gloves", "staff"],
		restrictedToArmorType: "silk",
		displayFormat: "Gain {value}% of Spell Damage as Extra Void Damage",
		isGlobalStat: true,
		tags: ["void", "elemental", "spell"],
		tiers: createStandardTiers(1, 3, 12, 18),
	},
};
