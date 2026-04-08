import type { Modifier } from "../../types";
import { createStandardTiers } from "../../types";

export const UTILITY_MODIFIERS: Record<string, Modifier> = {
	movementSpeedIncrease: {
		id: "movementSpeedIncrease",
		name: "of Speed",
		affixType: "suffix",
		modifierType: "increased",
		category: "utility",
		applicableTo: ["boots"],
		displayFormat: "+{value}% increased Movement Speed",
		isGlobalStat: true,
		tags: ["speed"],
		weight: 600,
		tiers: createStandardTiers(5, 8, 25, 30),
	},
	lifeLeechPercent: {
		id: "lifeLeechPercent",
		name: "of Leeching",
		affixType: "suffix",
		modifierType: "flat",
		category: "utility",
		applicableTo: ["allAttackWeapons", "ring", "amulet", "gloves"],
		displayFormat: "+{value}% of Physical Attack Damage Leeched as Life",
		isGlobalStat: true,
		tags: ["physical", "attack", "life"],
		weight: 400,
		tiers: createStandardTiers(1, 1, 2, 4),
	},

	// ── Niche / filler mods (no tags — no synergy pull) ──
	stunDurationIncrease: {
		id: "stunDurationIncrease",
		name: "of Stunning",
		affixType: "suffix",
		modifierType: "increased",
		category: "utility",
		applicableTo: ["weapon", "ring", "amulet", "belt"],
		displayFormat: "+{value}% increased Stun Duration",
		isGlobalStat: true,
		weight: 1500,
		tiers: createStandardTiers(5, 10, 31, 35),
	},
	reducedAttributeRequirements: {
		id: "reducedAttributeRequirements",
		name: "of the Worthy",
		affixType: "suffix",
		modifierType: "flat",
		category: "utility",
		applicableTo: ["allArmor"],
		displayFormat: "-{value}% Attribute Requirements",
		isGlobalStat: true,
		weight: 1500,
		tiers: createStandardTiers(5, 10, 21, 25),
	},

	// ── Bad mods (no tags) ──
	lightRadius: {
		id: "lightRadius",
		name: "of Shining",
		affixType: "suffix",
		modifierType: "increased",
		category: "utility",
		applicableTo: ["helmet", "ring"],
		displayFormat: "+{value}% increased Light Radius",
		isGlobalStat: true,
		weight: 2000,
		tiers: createStandardTiers(5, 10, 21, 25),
	},
};
