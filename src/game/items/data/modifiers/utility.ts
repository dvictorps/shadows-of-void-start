import type { Modifier } from "../../types"
import { createStandardTiers } from "../../types"

export const UTILITY_MODIFIERS: Record<string, Modifier> = {
	movementSpeedIncrease: {
		id: "movementSpeedIncrease",
		name: "of Speed",
		affixType: "suffix",
		modifierType: "increased",
		category: "utility",
		applicableTo: ["boots"],
		displayFormat: "+{value}% Movement Speed",
		isGlobalStat: true,
		weight: 600,
		tiers: createStandardTiers(5, 8, 41, 45),
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
		weight: 400,
		tiers: createStandardTiers(1, 1, 2, 3),
	},

	// ── Niche / filler mods ──
	stunDurationIncrease: {
		id: "stunDurationIncrease",
		name: "of Stunning",
		affixType: "suffix",
		modifierType: "increased",
		category: "utility",
		applicableTo: ["weapon", "ring", "amulet", "belt"],
		displayFormat: "+{value}% Stun Duration",
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
		weight: 1500,
		tiers: createStandardTiers(5, 10, 21, 25),
	},

	// ── Bad mods ──
	lightRadius: {
		id: "lightRadius",
		name: "of Shining",
		affixType: "suffix",
		modifierType: "increased",
		category: "utility",
		applicableTo: ["helmet", "ring"],
		displayFormat: "+{value}% Light Radius",
		isGlobalStat: true,
		weight: 2000,
		tiers: createStandardTiers(5, 10, 21, 25),
	},
}
