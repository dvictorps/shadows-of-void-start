import type { Modifier } from "../../types";
import { createStandardTiers } from "../../types";

// Tiers are provisional — the codebase-wide tier rebalance hasn't happened yet.
export const TOME_MODIFIERS: Record<string, Modifier> = {
	tomeGainAsExtraCold: {
		id: "tomeGainAsExtraCold",
		name: "Frost-Touched",
		affixType: "prefix",
		modifierType: "flat",
		category: "offensive",
		applicableTo: ["tome"],
		displayFormat: "Gain {value}% of Spell Damage as Extra Cold Damage",
		isGlobalStat: true,
		tags: ["cold", "elemental", "spell"],
		tiers: createStandardTiers(1, 3, 12, 18),
	},
	tomeGainAsExtraFire: {
		id: "tomeGainAsExtraFire",
		name: "Burning-Page",
		affixType: "prefix",
		modifierType: "flat",
		category: "offensive",
		applicableTo: ["tome"],
		displayFormat: "Gain {value}% of Spell Damage as Extra Fire Damage",
		isGlobalStat: true,
		tags: ["fire", "elemental", "spell"],
		tiers: createStandardTiers(1, 3, 12, 18),
	},
	tomeGainAsExtraLightning: {
		id: "tomeGainAsExtraLightning",
		name: "Storm-Bound",
		affixType: "prefix",
		modifierType: "flat",
		category: "offensive",
		applicableTo: ["tome"],
		displayFormat: "Gain {value}% of Spell Damage as Extra Lightning Damage",
		isGlobalStat: true,
		tags: ["lightning", "elemental", "spell"],
		tiers: createStandardTiers(1, 3, 12, 18),
	},
	tomeGainAsExtraVoid: {
		id: "tomeGainAsExtraVoid",
		name: "Abyss-Inscribed",
		affixType: "prefix",
		modifierType: "flat",
		category: "offensive",
		applicableTo: ["tome"],
		displayFormat: "Gain {value}% of Spell Damage as Extra Void Damage",
		isGlobalStat: true,
		tags: ["void", "elemental", "spell"],
		tiers: createStandardTiers(1, 3, 12, 18),
	},
};
