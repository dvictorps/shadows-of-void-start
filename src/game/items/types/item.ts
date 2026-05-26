import type { ArmorType, BaseStatKey, EquipmentType, WeaponType } from "./base";
import type { AffixType } from "./mods";

// ── Rarity ──

// `unique` is the PoE-style tier for handcrafted single-identity entities:
// act bosses today, planned unique items in Act 2+. Uniques bypass the affix
// roll system entirely — their stats/mods are declared, not rolled — so the
// MOD_LIMITS entry is all-zero. See CONTEXT.md → Boss.
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

export const MOD_LIMITS: Record<ItemRarity, ModLimits> = {
	normal: { totalMin: 0, totalMax: 0, maxPrefix: 0, maxSuffix: 0 },
	magic: { totalMin: 1, totalMax: 2, maxPrefix: 2, maxSuffix: 2 },
	rare: { totalMin: 3, totalMax: 4, maxPrefix: 2, maxSuffix: 2 },
	legendary: { totalMin: 5, totalMax: 5, maxPrefix: 3, maxSuffix: 3 },
	epic: { totalMin: 6, totalMax: 6, maxPrefix: 3, maxSuffix: 3 },
	unique: { totalMin: 0, totalMax: 0, maxPrefix: 0, maxSuffix: 0 },
};

// ── Rolled results ──

export interface RolledImplicit {
	// Optional for back-compat with items rolled before implicits were wired
	// into the stat engine — those legacy implicits stay display-only. New
	// rolls always carry the id.
	modifierId?: string;
	description: string;
	value: number;
}

export interface RolledMod {
	modifierId: string;
	// Legacy field — items rolled before the lexicon refactor carry the EN
	// affix name here. New rolls omit it; the renderer reads modifierId and
	// resolves the display string through lexicon/{en,pt}.ts.
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

// ── Computed weapon stats (base + local mods applied) ──

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

// ── Computed defense stats (base + local mods applied) ──

export interface ComputedDefenseStats {
	armor?: number;
	evasion?: number;
	barrier?: number;
	blockChance?: number;
}

// ── Generated item ──

export interface GeneratedItem {
	id: string;
	templateId: string;
	// Naming decomposition copied from the template so the renderer can
	// compose the display name without re-loading the template. Typed as
	// `string` here (not the narrow union) because the Convex validator
	// stores them as plain strings — the literal-union enforcement lives in
	// the lexicon/template files themselves. Optional because items rolled
	// before the decomposition refactor don't carry these fields; the
	// renderer falls back to the templateId string for those legacy rows.
	nameBase?: string;
	nameModifier?: string | null;
	// Legacy fields — items rolled before the lexicon refactor cached the EN
	// display name here. New rolls omit them; consumers must use
	// translateItemName / translateTemplateName (display-time, locale-aware).
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
	// Item-local sprite path. Takes precedence over the template's icon when
	// rendering — for hand-authored items (starter gear) without a template.
	icon?: string;
}
