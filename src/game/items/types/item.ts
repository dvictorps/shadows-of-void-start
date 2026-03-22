import type { ArmorType, BaseStatKey, EquipmentType, WeaponType } from "./base"
import type { AffixType } from "./mods"

// ── Rarity ──

export type ItemRarity = "normal" | "magic" | "rare" | "legendary" | "epic"

export interface ModLimits {
	totalMin: number
	totalMax: number
	maxPrefix: number
	maxSuffix: number
}

export const MOD_LIMITS: Record<ItemRarity, ModLimits> = {
	normal: { totalMin: 0, totalMax: 0, maxPrefix: 0, maxSuffix: 0 },
	magic: { totalMin: 1, totalMax: 2, maxPrefix: 2, maxSuffix: 2 },
	rare: { totalMin: 3, totalMax: 4, maxPrefix: 2, maxSuffix: 2 },
	legendary: { totalMin: 5, totalMax: 5, maxPrefix: 3, maxSuffix: 3 },
	epic: { totalMin: 6, totalMax: 6, maxPrefix: 3, maxSuffix: 3 },
}

// ── Rolled results ──

export interface RolledImplicit {
	description: string
	value: number
}

export interface RolledMod {
	modifierId: string
	modifierName: string
	affixType: AffixType
	modifierType: string
	isGlobalStat: boolean
	tier: number
	value: number
	minValue?: number
	maxValue?: number
	description: string
}

// ── Computed weapon stats (base + local mods applied) ──

export interface ElementalDamageEntry {
	element: string
	min: number
	max: number
}

export interface ComputedWeaponStats {
	physicalDamage: { min: number; max: number }
	elementalDamage: ElementalDamageEntry[]
	attackSpeed: number
	criticalChance: number
}

// ── Computed defense stats (base + local mods applied) ──

export interface ComputedDefenseStats {
	armor?: number
	evasion?: number
	barrier?: number
	blockChance?: number
}

// ── Generated item ──

export interface GeneratedItem {
	id: string
	templateId: string
	templateName: string
	equipmentType: EquipmentType
	weaponType?: WeaponType
	armorType?: ArmorType
	rarity: ItemRarity
	name: string
	itemLevel: number
	baseStats: Partial<Record<BaseStatKey, number>>
	implicits: RolledImplicit[]
	explicits: RolledMod[]
	computedStats?: ComputedWeaponStats
	computedDefenseStats?: ComputedDefenseStats
}
