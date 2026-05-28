import type { Modifier } from "../../types";
import { createStandardTiers } from "../../types";

// Gain-as-extra mods roll on tomes, amulets, silk gloves, and staves — the
// "mage-flavor" mod family. restrictedToArmorType narrows the gloves slot to
// silk only (no-op on tome/amulet/staff where armorType is undefined; see
// ADR 0007).
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
