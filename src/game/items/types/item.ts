import type { ArmorType, BaseStatKey, EquipmentType, WeaponType } from "./base";
import type { AffixType } from "./mods";

export type ItemRarity =
	| "normal"
	| "magic"
	| "rare"
	| "legendary"
	| "epic"
	| "unique";

export interface ModLimits {
	totalMin: number;
	totalMax: number;
	maxPrefix: number;
	maxSuffix: number;
}

export const MOD_LIMITS = {
	normal: { totalMin: 0, totalMax: 0, maxPrefix: 0, maxSuffix: 0 },
	magic: { totalMin: 1, totalMax: 2, maxPrefix: 2, maxSuffix: 2 },
	rare: { totalMin: 3, totalMax: 4, maxPrefix: 2, maxSuffix: 2 },
	legendary: { totalMin: 5, totalMax: 5, maxPrefix: 3, maxSuffix: 3 },
	epic: { totalMin: 6, totalMax: 6, maxPrefix: 3, maxSuffix: 3 },
	unique: { totalMin: 0, totalMax: 0, maxPrefix: 0, maxSuffix: 0 },
} satisfies Record<ItemRarity, ModLimits>;

export interface RolledImplicit {
	modifierId?: string;
	description: string;
	value: number;
}

export interface RolledMod {
	modifierId: string;
	modifierName?: string;
	affixType: AffixType;
	modifierType: string;
	isGlobalStat: boolean;
	tier: number;
	value: number;
	minValue?: number;
	maxValue?: number;
	description: string;
}

export interface ElementalDamageEntry {
	element: string;
	min: number;
	max: number;
}

export interface ComputedWeaponStats {
	physicalDamage: { min: number; max: number };
	elementalDamage: ElementalDamageEntry[];
	attackSpeed: number;
	criticalChance: number;
}

export interface ComputedDefenseStats {
	armor?: number;
	evasion?: number;
	barrier?: number;
	blockChance?: number;
}

export interface GeneratedItem {
	id: string;
	templateId: string;
	nameBase?: string;
	nameModifier?: string | null;
	templateName?: string;
	name?: string;
	equipmentType: EquipmentType;
	weaponType?: WeaponType;
	armorType?: ArmorType;
	rarity: ItemRarity;
	itemLevel: number;
	baseStats: Partial<Record<BaseStatKey, number>>;
	implicits: RolledImplicit[];
	explicits: RolledMod[];
	computedStats?: ComputedWeaponStats;
	computedDefenseStats?: ComputedDefenseStats;
	requirements?: {
		level: number;
		str?: number;
		dex?: number;
		int?: number;
	};
	icon?: string;
}
