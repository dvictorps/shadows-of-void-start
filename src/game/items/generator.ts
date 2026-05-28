// ─────────────────────────────────────────────────────────────────────────────
//  Item generator — rolls a GeneratedItem from a template + rarity + ilvl.
//  Pure (deterministic given a seeded RNG). Used by the loot pipeline and by
//  starter-gear. The public entry point is `generateItem`.
//
//  Sections (grep the headers to jump):
//    ── RNG helpers ──                              randInt, pickRandom, pickWeighted
//    ── Name generation ──                          rare/legendary/epic naming
//    ── Value formatting ──                         describes mod values for display
//    ── Defense label resolution ──                 local defense → armor/evasion/barrier
//    ── Modifier eligibility ──                     resolves applicableTo against template
//    ── Synergy system ──                           intelligent rolls for epic/legendary
//    ── Deterministic epic mod patterns ──          fixed archetypes for epic rolls
//    ── Rolling logic ──                            rollImplicits, rollExplicits  ← core
//    ── Compute weapon stats ──                     bakes statEffect mods into computedStats
//    ── Compute armor stats ──                      same for defense pieces (incl. tomes)
//    ── Item naming ──                              composes affix names onto template
//    ── Public API ──                               GenerateItemOptions, generateItem  ← entry
//
//  Common tasks:
//    • Add a new modifier id      →  see `data/modifiers/`; if it has statEffect, also
//                                    extend computeWeaponStats / computeArmorStats here
//    • Add a new equipment type   →  Modifier eligibility (groups), Compute armor stats,
//                                    and `data/templates/`
//    • Change rarity / mod counts →  see MOD_LIMITS in `types/mods.ts`; consumed by
//                                    rollExplicits below
//    • Add a new local statEffect →  case in computeWeaponStats or computeArmorStats
// ─────────────────────────────────────────────────────────────────────────────

import {
	getModifierTierForItemLevel,
	MODIFIERS,
	type ModifierId,
} from "./data/modifiers";
import type { EquipmentTemplate } from "./data/templates";
import { EQUIPMENT_TEMPLATES, TEMPLATE_BY_ID } from "./data/templates";
import type {
	ArmorType,
	BaseStatKey,
	ComputedDefenseStats,
	ComputedWeaponStats,
	EquipmentGroup,
	GeneratedItem,
	ItemRarity,
	RolledImplicit,
	RolledMod,
} from "./types";
import { DEFAULT_MODIFIER_WEIGHT, EQUIPMENT_GROUPS, MOD_LIMITS } from "./types";

// ── RNG helpers ──

function randInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

function pickWeighted<T>(items: T[], getWeight: (item: T) => number): T {
	const totalWeight = items.reduce((sum, item) => sum + getWeight(item), 0);
	let roll = Math.random() * totalWeight;
	for (const item of items) {
		roll -= getWeight(item);
		if (roll <= 0) return item;
	}
	return items[items.length - 1];
}

// ── Value formatting ──

function formatValue(value: number): string {
	return String(Math.round(value));
}

function formatDescription(displayFormat: string, value: number): string {
	return displayFormat.replace("{value}", formatValue(value));
}

function formatRangeDescription(
	displayFormat: string,
	min: number,
	max: number,
): string {
	return displayFormat.replace(
		"{value}",
		`${formatValue(min)}-${formatValue(max)}`,
	);
}

// ── Defense label resolution (local defense mods adapt to armor base type) ──

type DefenseStatKey = "armor" | "evasion" | "barrier";

export const DEFENSE_LABELS: Record<
	string,
	{ stat: DefenseStatKey; flat: string; pct: string }
> = {
	plate: { stat: "armor", flat: "Armor", pct: "Armor" },
	leather: { stat: "evasion", flat: "Evasion Rating", pct: "Evasion" },
	silk: { stat: "barrier", flat: "Barrier", pct: "Barrier" },
};

export function resolveDefenseFormat(
	modId: string,
	displayFormat: string,
	armorType?: string,
): string {
	if (!armorType) return displayFormat;
	const labels = DEFENSE_LABELS[armorType];
	if (!labels) return displayFormat;
	if (modId === "localDefenseFlat")
		return displayFormat.replace("Defense", labels.flat);
	if (modId === "localDefenseIncrease")
		return displayFormat.replace("Defense", labels.pct);
	return displayFormat;
}

// ── Modifier eligibility (derived from applicableTo, resolves groups) ──

function isGroupKey(target: string): target is EquipmentGroup {
	return target in EQUIPMENT_GROUPS;
}

const MOD_REQUIRED_ARMOR_TYPE: Record<string, ArmorType> = {
	globalArmorIncrease: "plate",
	globalEvasionIncrease: "leather",
	globalBarrierIncrease: "silk",
	globalSpellDamageIncrease: "silk",
};

// Maps the four spell-flat mod ids (isGlobalStat-tagged, no statEffect) to the
// elemental damage entry they fold into the spell weapon's swing. The mods
// don't accumulate as character globals — see compute.ts no-op for the same
// ids. Exported so tests can assert against the same source-of-truth.
export const SPELL_FLAT_TO_ELEMENT: Record<string, string> = {
	coldDamageFlat: "Cold",
	fireDamageFlat: "Fire",
	lightningDamageFlat: "Lightning",
	voidDamageFlat: "Void",
};

function getModifiersForTemplate(template: EquipmentTemplate): ModifierId[] {
	return (Object.keys(MODIFIERS) as ModifierId[]).filter((modId) => {
		const mod = MODIFIERS[modId];

		// Gate mods to a specific armor base, from either the per-mod inline
		// field (ADR 0007) or the legacy MOD_REQUIRED_ARMOR_TYPE registry.
		// Non-armor templates (weapons, jewelry, tomes) pass through.
		const requiredArmorType =
			mod.restrictedToArmorType ?? MOD_REQUIRED_ARMOR_TYPE[modId];
		if (
			requiredArmorType &&
			template.armorType &&
			template.armorType !== requiredArmorType
		) {
			return false;
		}

		return mod.applicableTo.some((target) => {
			if (isGroupKey(target)) {
				const members = EQUIPMENT_GROUPS[target] as readonly string[];
				return (
					members.includes(template.equipmentType) ||
					(template.weaponType != null && members.includes(template.weaponType))
				);
			}
			return (
				target === template.equipmentType ||
				(template.weaponType != null && target === template.weaponType)
			);
		});
	});
}

// ── Synergy system (intelligent generation for epic/legendary) ──

const SYNERGY_MULTIPLIERS: Partial<Record<ItemRarity, number>> = {
	epic: 3,
	legendary: 1.5,
};

export function getSynergyWeight(
	baseWeight: number,
	candidateTags: string[],
	rolledTags: Set<string>,
	synergyMultiplier: number,
): number {
	if (
		synergyMultiplier === 0 ||
		rolledTags.size === 0 ||
		candidateTags.length === 0
	)
		return baseWeight;
	let matches = 0;
	for (const tag of candidateTags) {
		if (rolledTags.has(tag)) matches++;
	}
	return baseWeight * (1 + synergyMultiplier * matches);
}

const SPELL_WEAPON_SET = new Set(["staff", "wand"]);
const ARMOR_SLOTS = new Set(["helmet", "chestplate", "boots", "gloves"]);

// ── Deterministic epic mod patterns ──

type EpicArchetype =
	| "attackWeapon"
	| "spellWeapon"
	| "armor"
	| "boots"
	| "shield"
	| "belt"
	| "ring"
	| "amulet";

interface EpicModPattern {
	prefixes: ModifierId[];
	suffixes: ModifierId[];
}

const EPIC_MOD_PATTERNS: Record<EpicArchetype, EpicModPattern> = {
	attackWeapon: {
		prefixes: [
			"physicalDamageFlat",
			"physicalDamageIncrease",
			"coldDamageToAttacksFlat",
			"fireDamageToAttacksFlat",
			"lightningDamageToAttacksFlat",
			"voidDamageToAttacksFlat",
		] as ModifierId[],
		suffixes: [
			"attackSpeedIncrease",
			"criticalChanceIncrease",
			"criticalStrikeMultiplierFlat",
			"accuracyFlat",
		] as ModifierId[],
	},
	spellWeapon: {
		prefixes: [
			"coldDamageFlat",
			"fireDamageFlat",
			"lightningDamageFlat",
			"voidDamageFlat",
			"globalSpellDamageIncrease",
			"globalColdDamageIncrease",
			"globalFireDamageIncrease",
			"globalLightningDamageIncrease",
			"globalVoidDamageIncrease",
			"globalElementalDamageIncrease",
		] as ModifierId[],
		suffixes: [
			"globalCastSpeedIncrease",
			"globalCriticalChanceIncrease",
			"criticalStrikeMultiplierFlat",
			"manaRegenFlat",
		] as ModifierId[],
	},
	armor: {
		prefixes: ["localDefenseFlat", "healthFlat", "manaFlat"] as ModifierId[],
		suffixes: [
			"localDefenseIncrease",
			"coldResistance",
			"fireResistance",
			"lightningResistance",
			"voidResistance",
			"healthRegenFlat",
		] as ModifierId[],
	},
	boots: {
		prefixes: ["localDefenseFlat", "healthFlat", "manaFlat"] as ModifierId[],
		suffixes: [
			"localDefenseIncrease",
			"coldResistance",
			"fireResistance",
			"lightningResistance",
			"voidResistance",
			"healthRegenFlat",
			"movementSpeedIncrease",
		] as ModifierId[],
	},
	shield: {
		prefixes: ["localDefenseFlat", "healthFlat", "manaFlat"] as ModifierId[],
		suffixes: [
			"localDefenseIncrease",
			"blockChanceIncrease",
			"coldResistance",
			"fireResistance",
			"lightningResistance",
			"voidResistance",
		] as ModifierId[],
	},
	belt: {
		prefixes: [
			"healthFlat",
			"armorFlat",
			"evasionFlat",
			"barrierFlat",
			"manaFlat",
		] as ModifierId[],
		suffixes: [
			"coldResistance",
			"fireResistance",
			"lightningResistance",
			"voidResistance",
			"strengthFlat",
			"dexterityFlat",
			"intelligenceFlat",
		] as ModifierId[],
	},
	ring: {
		prefixes: [
			"healthFlat",
			"physicalDamageFlatGlobal",
			"armorFlat",
			"evasionFlat",
			"barrierFlat",
			"lifeGainOnHitFlat",
		] as ModifierId[],
		suffixes: [
			"coldResistance",
			"fireResistance",
			"lightningResistance",
			"voidResistance",
			"criticalStrikeMultiplierFlat",
			"accuracyFlat",
			"lifeLeechPercent",
		] as ModifierId[],
	},
	amulet: {
		prefixes: [
			"healthFlat",
			"physicalDamageFlatGlobal",
			"globalPhysicalDamageIncrease",
			"globalSpellDamageIncrease",
			"lifeGainOnHitFlat",
		] as ModifierId[],
		suffixes: [
			"coldResistance",
			"fireResistance",
			"lightningResistance",
			"voidResistance",
			"strengthFlat",
			"dexterityFlat",
			"intelligenceFlat",
			"criticalStrikeMultiplierFlat",
		] as ModifierId[],
	},
};

function getEpicArchetype(template: EquipmentTemplate): EpicArchetype | null {
	if (template.equipmentType === "weapon") {
		if (SPELL_WEAPON_SET.has(template.weaponType ?? "")) return "spellWeapon";
		return "attackWeapon";
	}
	if (template.equipmentType === "offhand") return "shield";
	if (template.equipmentType === "boots") return "boots";
	if (ARMOR_SLOTS.has(template.equipmentType)) return "armor";
	if (template.equipmentType === "belt") return "belt";
	if (template.equipmentType === "ring") return "ring";
	if (template.equipmentType === "amulet") return "amulet";
	return null;
}

const EPIC_MIN_TIER = 4;

// ── Rolling logic ──

function rollImplicits(template: EquipmentTemplate): RolledImplicit[] {
	return template.implicits.map((imp) => {
		const value = randInt(imp.minValue, imp.maxValue);
		return {
			modifierId: imp.modifierId,
			description: formatDescription(imp.displayFormat, value),
			value,
		};
	});
}

function rollExplicits(
	rarity: ItemRarity,
	template: EquipmentTemplate,
	itemLevel: number,
): RolledMod[] {
	const limits = MOD_LIMITS[rarity];
	if (limits.totalMax === 0) return [];

	const totalTarget = randInt(limits.totalMin, limits.totalMax);
	const availableModifiers = getModifiersForTemplate(template);

	// Epic: use deterministic mod patterns
	const isEpic = rarity === "epic";
	const epicArchetype = isEpic ? getEpicArchetype(template) : null;
	const epicPattern = epicArchetype ? EPIC_MOD_PATTERNS[epicArchetype] : null;

	let prefixTarget: number;
	let suffixTarget: number;

	if (rarity === "legendary") {
		if (Math.random() < 0.5) {
			prefixTarget = 3;
			suffixTarget = 2;
		} else {
			prefixTarget = 2;
			suffixTarget = 3;
		}
	} else if (rarity === "epic") {
		prefixTarget = 3;
		suffixTarget = 3;
	} else {
		const maxP = Math.min(totalTarget, limits.maxPrefix);
		const minP = Math.max(0, totalTarget - limits.maxSuffix);
		prefixTarget = randInt(minP, maxP);
		suffixTarget = totalTarget - prefixTarget;
	}

	const mods: RolledMod[] = [];
	const usedModIds = new Set<string>();

	// Synergy: seed tags for legendary only now (epic uses deterministic patterns)
	const synergyMultiplier =
		rarity === "legendary" ? (SYNERGY_MULTIPLIERS[rarity] ?? 0) : 0;
	const rolledTags = new Set<string>();

	// Pre-resolve tiers for all available modifiers at this item level
	const tierCache = new Map<
		ModifierId,
		ReturnType<typeof getModifierTierForItemLevel>
	>();
	for (const modId of availableModifiers) {
		const tier = getModifierTierForItemLevel(modId, itemLevel);
		if (tier) tierCache.set(modId, tier);
	}

	// For epic items, also cache tiers for pattern mods that may not be in availableModifiers
	if (epicPattern) {
		for (const modId of [...epicPattern.prefixes, ...epicPattern.suffixes]) {
			if (!tierCache.has(modId)) {
				const tier = getModifierTierForItemLevel(modId, itemLevel);
				if (tier) tierCache.set(modId, tier);
			}
		}
	}

	const getEligible = (affixType: "prefix" | "suffix"): ModifierId[] => {
		// Epic: draw from pattern pool
		if (epicPattern) {
			const pool =
				affixType === "prefix" ? epicPattern.prefixes : epicPattern.suffixes;
			return pool.filter((modId) => {
				if (usedModIds.has(modId)) return false;
				return tierCache.has(modId);
			});
		}
		return availableModifiers.filter((modId) => {
			if (usedModIds.has(modId)) return false;
			const mod = MODIFIERS[modId];
			if (mod.affixType !== affixType) return false;
			return tierCache.has(modId);
		});
	};

	const rollMod = (affixType: "prefix" | "suffix"): boolean => {
		const eligible = getEligible(affixType);
		if (eligible.length === 0) return false;

		const modId = pickWeighted(eligible, (id) => {
			const m = MODIFIERS[id];
			return getSynergyWeight(
				m.weight ?? DEFAULT_MODIFIER_WEIGHT,
				m.tags ?? [],
				rolledTags,
				synergyMultiplier,
			);
		});
		const mod = MODIFIERS[modId];
		let tier = tierCache.get(modId)!;

		// Epic: clamp to minimum tier 4 (lower number = better, so use Math.min)
		if (isEpic && tier.tier > EPIC_MIN_TIER) {
			// Find tier 4 for this modifier
			const modDef = MODIFIERS[modId];
			const tier4 = modDef.tiers.find((t) => t.tier === EPIC_MIN_TIER);
			if (tier4) tier = tier4;
		}

		const displayFormat = resolveDefenseFormat(
			modId,
			mod.displayFormat,
			template.armorType,
		);

		// All flat damage mods roll as min-max range (min = half of max)
		const isFlatDamage =
			mod.modifierType === "flat" &&
			mod.category === "offensive" &&
			mod.displayFormat.includes("Damage to");

		let value: number;
		let minValue: number | undefined;
		let maxValue: number | undefined;

		if (isFlatDamage) {
			maxValue = randInt(tier.valueRange[0], tier.valueRange[1]);
			minValue = Math.round(maxValue / 2);
			value = maxValue;
		} else {
			value = randInt(tier.valueRange[0], tier.valueRange[1]);
		}

		mods.push({
			modifierId: modId,
			affixType: mod.affixType,
			modifierType: mod.modifierType,
			isGlobalStat: mod.isGlobalStat ?? false,
			tier: tier.tier,
			value,
			...(isFlatDamage && { minValue, maxValue }),
			description: isFlatDamage
				? formatRangeDescription(displayFormat, minValue!, maxValue!)
				: formatDescription(displayFormat, value),
		});
		usedModIds.add(modId);
		for (const tag of mod.tags ?? []) rolledTags.add(tag);
		return true;
	};

	for (let i = 0; i < prefixTarget; i++) {
		if (!rollMod("prefix")) break;
	}

	for (let i = 0; i < suffixTarget; i++) {
		if (!rollMod("suffix")) break;
	}

	// Sort: prefixes first (increased → flat), then suffixes (increased → flat)
	mods.sort((a, b) => {
		const affixOrder = (m: RolledMod) => (m.affixType === "prefix" ? 0 : 1);
		const typeOrder = (m: RolledMod) =>
			m.modifierType === "increased" ? 0 : 1;
		const aPri = affixOrder(a) * 10 + typeOrder(a);
		const bPri = affixOrder(b) * 10 + typeOrder(b);
		return aPri - bPri;
	});

	return mods;
}

// ── Compute weapon stats (base + local mods via statEffect) ──

function computeWeaponStats(
	baseStats: Partial<Record<BaseStatKey, number>>,
	explicits: RolledMod[],
): ComputedWeaponStats {
	let minPhys = baseStats.minDamage ?? 0;
	let maxPhys = baseStats.maxDamage ?? 0;
	let physIncrease = 0;
	let atkSpeed = baseStats.attackSpeed ?? 1;
	let atkSpeedIncrease = 0;
	let critChance = baseStats.criticalChance ?? 5;
	let critIncrease = 0;

	const elementalDamage: { element: string; min: number; max: number }[] = [];

	for (const mod of explicits) {
		const spellElement = SPELL_FLAT_TO_ELEMENT[mod.modifierId];
		if (spellElement) {
			elementalDamage.push({
				element: spellElement,
				min: mod.minValue ?? mod.value,
				max: mod.maxValue ?? mod.value,
			});
			continue;
		}

		const modifier = MODIFIERS[mod.modifierId as ModifierId];
		if (!modifier?.statEffect || modifier.isGlobalStat) continue;

		const { target, operation, element } = modifier.statEffect;

		switch (target) {
			case "physicalDamage":
				if (operation === "flat") {
					minPhys += mod.minValue ?? mod.value;
					maxPhys += mod.maxValue ?? mod.value;
				} else {
					physIncrease += mod.value;
				}
				break;
			case "attackSpeed":
				atkSpeedIncrease += mod.value;
				break;
			case "criticalChance":
				critIncrease += mod.value;
				break;
			case "elementalDamage":
				if (element) {
					elementalDamage.push({
						element,
						min: mod.minValue ?? mod.value,
						max: mod.maxValue ?? mod.value,
					});
				}
				break;
		}
	}

	// Apply %increased physical damage: base+flat → ×(1 + %inc)
	if (physIncrease > 0) {
		minPhys = Math.round(minPhys * (1 + physIncrease / 100));
		maxPhys = Math.round(maxPhys * (1 + physIncrease / 100));
	}

	// Apply %increased attack speed
	if (atkSpeedIncrease > 0) {
		atkSpeed = Math.round(atkSpeed * (1 + atkSpeedIncrease / 100) * 100) / 100;
	}

	// Apply %increased critical strike chance (multiplicative, not flat)
	if (critIncrease > 0) {
		critChance = critChance * (1 + critIncrease / 100);
	}

	return {
		physicalDamage: { min: minPhys, max: maxPhys },
		elementalDamage,
		attackSpeed: atkSpeed,
		criticalChance: Math.round(critChance * 10) / 10,
	};
}

// ── Compute armor stats (base + local defense mods via statEffect) ──

function computeArmorStats(
	baseStats: Partial<Record<BaseStatKey, number>>,
	armorType: string | undefined,
	explicits: RolledMod[],
	implicits: RolledImplicit[] = [],
): ComputedDefenseStats | undefined {
	const defenseInfo = armorType ? DEFENSE_LABELS[armorType] : null;

	let flatBonus = 0;
	let defenseIncrease = 0;
	let blockAdditive = 0;

	const accumulate = (mod: RolledImplicit | RolledMod) => {
		if (!mod.modifierId) return;
		const modifier = MODIFIERS[mod.modifierId as ModifierId];
		if (!modifier?.statEffect || modifier.isGlobalStat) return;

		if (modifier.statEffect.target === "defense") {
			if (modifier.statEffect.operation === "flat") flatBonus += mod.value;
			else defenseIncrease += mod.value;
		} else if (modifier.statEffect.target === "blockChance") {
			// Additive across base + impl + expl (see docs/plans/2026-05-28).
			blockAdditive += mod.value;
		}
	};

	for (const mod of implicits) accumulate(mod);
	for (const mod of explicits) accumulate(mod);

	const baseDefense = defenseInfo ? (baseStats[defenseInfo.stat] ?? 0) : 0;
	const baseBlock = baseStats.blockChance ?? 0;

	// Emit computedDefenseStats whenever the item has a defensive baseline OR
	// a defense/block mod rolled. The previous implementation only emitted on
	// rolled mods, which silently dropped the item's base armor/evasion/barrier
	// and shield blockChance for Normal pieces or rolls without defense mods.
	const hasDefense = defenseInfo && (baseDefense > 0 || flatBonus !== 0);
	const hasBlock = baseBlock > 0 || blockAdditive > 0;

	if (!hasDefense && !hasBlock) return undefined;

	const result: ComputedDefenseStats = {};

	if (hasDefense) {
		let value = baseDefense + flatBonus;
		if (defenseIncrease > 0) {
			value = Math.round(value * (1 + defenseIncrease / 100));
		}
		result[defenseInfo!.stat] = value;
	}

	if (hasBlock) {
		const block = baseBlock + blockAdditive;
		if (block > 0) result.blockChance = block;
	}

	return result;
}

// ── Public API ──

export interface GenerateItemOptions {
	itemLevel?: number;
	rarity: ItemRarity;
	templateId?: string;
}

export function generateItem(options: GenerateItemOptions): GeneratedItem {
	const itemLevel = Math.min(
		100,
		Math.max(1, options.itemLevel ?? randInt(1, 100)),
	);

	let template: EquipmentTemplate;
	if (options.templateId) {
		template =
			TEMPLATE_BY_ID.get(options.templateId) ?? pickRandom(EQUIPMENT_TEMPLATES);
	} else {
		const eligible = EQUIPMENT_TEMPLATES.filter(
			(t) => t.dropLevel <= itemLevel,
		);
		template =
			eligible.length > 0
				? pickRandom(eligible)
				: pickRandom(EQUIPMENT_TEMPLATES);
	}

	const implicits = rollImplicits(template);
	const explicits = rollExplicits(options.rarity, template, itemLevel);
	const baseStats = { ...template.baseStats };

	const isWeapon = "minDamage" in baseStats;
	const computed = isWeapon
		? computeWeaponStats(baseStats, explicits)
		: undefined;
	const computedDefense = computeArmorStats(
		baseStats,
		template.armorType,
		explicits,
		implicits,
	);

	return {
		id: crypto.randomUUID(),
		templateId: template.id,
		nameBase: template.nameBase,
		nameModifier: template.nameModifier,
		equipmentType: template.equipmentType,
		weaponType: template.weaponType,
		armorType: template.armorType,
		rarity: options.rarity,
		itemLevel,
		baseStats,
		implicits,
		explicits,
		computedStats: computed,
		computedDefenseStats: computedDefense,
		requirements: template.requirements,
	};
}
