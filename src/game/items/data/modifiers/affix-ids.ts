// Literal-union split of ModifierId by affix type. Lexicons key prefixForms /
// suffixPhrases by these unions to keep wrong-affix entries (e.g., a prefix
// id under suffixPhrases) a compile error. Lexicon fields are Partial<>, so
// missing translations are caught at runtime by the cross-coverage test in
// `translation-coverage.test.ts`, not at compile time.
//
// Must stay in sync with the `affixType` field of each entry in the MODIFIERS
// records below. A modifier never lives in both unions — affixType is a
// single value per modifier.
//
// Adding a new modifier: append its id here (or remove if affix flips).
// A simpler runtime check exists in MODIFIERS[id].affixType — this file
// duplicates it at type level so the lexicon types can use the narrow shape.

import type { ModifierId } from ".";

export type PrefixModifierId = Extract<
	ModifierId,
	| "localDefenseFlat"
	| "armorFlat"
	| "evasionFlat"
	| "barrierFlat"
	| "healthFlat"
	| "manaFlat"
	| "lifeGainOnHitFlat"
	| "manaGainOnHitFlat"
	| "globalPhysicalDamageIncrease"
	| "globalColdDamageIncrease"
	| "globalFireDamageIncrease"
	| "globalLightningDamageIncrease"
	| "globalVoidDamageIncrease"
	| "globalSpellDamageIncrease"
	| "globalElementalDamageWithAttacksIncrease"
	| "globalElementalDamageIncrease"
	| "globalMeleeDamageIncrease"
	| "itemRarityIncreasePrefix"
	| "coldDamageFlat"
	| "fireDamageFlat"
	| "lightningDamageFlat"
	| "voidDamageFlat"
	| "tomeGainAsExtraCold"
	| "tomeGainAsExtraFire"
	| "tomeGainAsExtraLightning"
	| "tomeGainAsExtraVoid"
	| "physicalDamageFlat"
	| "physicalDamageFlatGlobal"
	| "physicalDamageIncrease"
	| "coldDamageToAttacksFlat"
	| "fireDamageToAttacksFlat"
	| "lightningDamageToAttacksFlat"
	| "voidDamageToAttacksFlat"
	| "coldDamageToAttacksFlatGlobal"
	| "fireDamageToAttacksFlatGlobal"
	| "lightningDamageToAttacksFlatGlobal"
	| "voidDamageToAttacksFlatGlobal"
>;

export type SuffixModifierId = Extract<
	ModifierId,
	| "strengthFlat"
	| "dexterityFlat"
	| "intelligenceFlat"
	| "allAttributesFlat"
	| "localDefenseIncrease"
	| "globalArmorIncrease"
	| "globalEvasionIncrease"
	| "globalBarrierIncrease"
	| "healthRegenFlat"
	| "manaRegenFlat"
	| "lifeOnKillFlat"
	| "manaOnKillFlat"
	| "thornsDamageFlat"
	| "blockChanceIncrease"
	| "globalAttackSpeedIncrease"
	| "globalCastSpeedIncrease"
	| "globalCriticalChanceIncrease"
	| "itemRarityIncreaseSuffix"
	| "coldResistance"
	| "fireResistance"
	| "lightningResistance"
	| "voidResistance"
	| "movementSpeedIncrease"
	| "lifeLeechPercent"
	| "stunDurationIncrease"
	| "reducedAttributeRequirements"
	| "attackSpeedIncrease"
	| "criticalChanceIncrease"
	| "accuracyFlat"
	| "criticalStrikeMultiplierFlat"
>;
