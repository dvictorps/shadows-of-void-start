export {
	EQUIPMENT_TYPES,
	WEAPON_TYPES,
	ARMOR_TYPES,
	DAMAGE_ELEMENTS,
	ATTACK_WEAPON_TYPES,
	EQUIPMENT_GROUPS,
} from "./base"

export type {
	EquipmentType,
	WeaponType,
	ArmorType,
	DamageElement,
	ModifierApplicableTo,
	EquipmentGroup,
	BaseStatKey,
} from "./base"

export { MODIFIER_TYPES, DEFAULT_MODIFIER_WEIGHT, createStandardTiers } from "./mods"

export type {
	ModifierTypeId,
	ModifierCategory,
	AffixType,
	ModifierTier,
	Modifier,
	LocalStatTarget,
	StatEffect,
} from "./mods"

export { MOD_LIMITS } from "./item"

export type {
	ItemRarity,
	ModLimits,
	RolledImplicit,
	RolledMod,
	GeneratedItem,
	ComputedWeaponStats,
	ElementalDamageEntry,
	ComputedDefenseStats,
} from "./item"
