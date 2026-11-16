// ─────────────────────────────────────────────────────────────────────────────
//  Item generator — rolls a GeneratedItem from a template + rarity + ilvl.
//  Pure (deterministic given a seeded RNG). Used by the loot pipeline and by
//  starter-gear. The public entry point is `generateItem`.
//
//  Sections (grep the headers to jump):
//    ── RNG helpers ──                              pickRandom, pickWeighted (non-empty)
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

import { chance, randInt, randomId, randomUnit } from "#/lib/rng";

import {
	findModifier,
	getModifier,
	getModifierTierForItemLevel,
	MODIFIER_IDS,
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
// Non-empty variants of `#/lib/rng`'s pickers (every call site here has
// already guarded the length), drawing from the same `randomUnit` seam.

function pickRandom<T>(arr: T[]): T {
	return arr[Math.floor(randomUnit() * arr.length)];
}

function pickWeighted<T>(items: T[], getWeight: (item: T) => number): T {
	const totalWeight = items.reduce((sum, item) => sum + getWeight(item), 0);
	let roll = randomUnit() * totalWeight;
	// Float drift can leave `roll` a hair above 0 after the loop; fall back to
	// the last item, same as the old `items[items.length - 1]`.
	let last = items[0];
	for (const item of items) {
		roll -= getWeight(item);
		if (roll <= 0) return item;
		last = item;
	}
	return last;
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

export const DEFENSE_LABELS = {
	plate: { stat: "armor", flat: "Armor", pct: "Armor" },
	leather: { stat: "evasion", flat: "Evasion Rating", pct: "Evasion" },
	silk: { stat: "barrier", flat: "Barrier", pct: "Barrier" },
} satisfies Record<
	ArmorType,
	{ stat: DefenseStatKey; flat: string; pct: string }
>;

export function resolveDefenseFormat(
	modId: string,
	displayFormat: string,
	armorType?: ArmorType,
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

const MOD_REQUIRED_ARMOR_TYPE: ReadonlyMap<ModifierId, ArmorType> = new Map([
	["globalArmorIncrease", "plate"],
	["globalEvasionIncrease", "leather"],
	["globalBarrierIncrease", "silk"],
	["globalSpellDamageIncrease", "silk"],
]);

// Maps the four spell-flat mod ids (isGlobalStat-tagged, no statEffect) to the
// elemental damage entry they fold into the spell weapon's swing. The mods
// don't accumulate as character globals — see compute.ts no-op for the same
// ids. Exported so tests can assert against the same source-of-truth.
export const SPELL_FLAT_TO_ELEMENT: ReadonlyMap<string, string> = new Map([
	["coldDamageFlat", "Cold"],
	["fireDamageFlat", "Fire"],
	["lightningDamageFlat", "Lightning"],
	["voidDamageFlat", "Void"],
]);

function getModifiersForTemplate(template: EquipmentTemplate): ModifierId[] {
	return MODIFIER_IDS.filter((modId) => {
		const mod = getModifier(modId);

		// Gate mods to a specific armor base, from either the per-mod inline
		// field (ADR 0007) or the legacy MOD_REQUIRED_ARMOR_TYPE registry.
		// Non-armor templates (weapons, jewelry, tomes) pass through.
		const requiredArmorType =
			mod.restrictedToArmorType ?? MOD_REQUIRED_ARMOR_TYPE.get(modId);
		if (
			requiredArmorType &&
			template.armorType &&
			template.armorType !== requiredArmorType
		) {
			return false;
		}

		// Slot-conditional implicit gate (ADR 0007). Only narrows amulets —
		// the slot where attribute-typed implicits live. Other slots pass.
		if (mod.restrictedToImplicitMod && template.equipmentType === "amulet") {
			const hasImplicit = template.implicits.some(
				(imp) => imp.modifierId === mod.restrictedToImplicitMod,
			);
			if (!hasImplicit) return false;
		}

		return mod.applicableTo.some((target) => {
			if (isGroupKey(target)) {
				const members: readonly string[] = EQUIPMENT_GROUPS[target];
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

const SYNERGY_MULTIPLIERS = {
	epic: 3,
	legendary: 1.5,
} satisfies Partial<Record<ItemRarity, number>>;

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

const EPIC_MOD_PATTERNS = {
	attackWeapon: {
		prefixes: [
			"physicalDamageFlat",
			"physicalDamageIncrease",
			"coldDamageToAttacksFlat",
			"fireDamageToAttacksFlat",
			"lightningDamageToAttacksFlat",
			"voidDamageToAttacksFlat",
		],
		suffixes: [
			"attackSpeedIncrease",
			"criticalChanceIncrease",
			"criticalStrikeMultiplierFlat",
			"accuracyFlat",
		],
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
			// Mage-flavor: applicableTo includes "staff" only — wands are
			// eligibility-filtered out, so epic wands never get these.
			"tomeGainAsExtraCold",
			"tomeGainAsExtraFire",
			"tomeGainAsExtraLightning",
			"tomeGainAsExtraVoid",
		],
		suffixes: [
			"globalCastSpeedIncrease",
			"globalCriticalChanceIncrease",
			"criticalStrikeMultiplierFlat",
			"manaRegenFlat",
		],
	},
	armor: {
		prefixes: [
			"localDefenseFlat",
			"healthFlat",
			"manaFlat",
			// Mage-flavor: applicableTo includes "gloves" only AND
			// restrictedToArmorType "silk" — epic plate/leather gloves never
			// roll these; epic helmet/chestplate never roll these.
			"tomeGainAsExtraCold",
			"tomeGainAsExtraFire",
			"tomeGainAsExtraLightning",
			"tomeGainAsExtraVoid",
		],
		suffixes: [
			"localDefenseIncrease",
			"coldResistance",
			"fireResistance",
			"lightningResistance",
			"voidResistance",
			"healthRegenFlat",
		],
	},
	boots: {
		prefixes: ["localDefenseFlat", "healthFlat", "manaFlat"],
		suffixes: [
			"localDefenseIncrease",
			"coldResistance",
			"fireResistance",
			"lightningResistance",
			"voidResistance",
			"healthRegenFlat",
			"movementSpeedIncrease",
		],
	},
	shield: {
		prefixes: ["localDefenseFlat", "healthFlat", "manaFlat"],
		suffixes: [
			"localDefenseIncrease",
			"blockChanceIncrease",
			"coldResistance",
			"fireResistance",
			"lightningResistance",
			"voidResistance",
		],
	},
	belt: {
		prefixes: [
			"healthFlat",
			"armorFlat",
			"evasionFlat",
			"barrierFlat",
			"manaFlat",
		],
		suffixes: [
			"coldResistance",
			"fireResistance",
			"lightningResistance",
			"voidResistance",
			"strengthFlat",
			"dexterityFlat",
			"intelligenceFlat",
		],
	},
	ring: {
		prefixes: [
			"healthFlat",
			"physicalDamageFlatGlobal",
			"armorFlat",
			"evasionFlat",
			"barrierFlat",
			"lifeGainOnHitFlat",
		],
		suffixes: [
			"coldResistance",
			"fireResistance",
			"lightningResistance",
			"voidResistance",
			"criticalStrikeMultiplierFlat",
			"accuracyFlat",
			"lifeLeechPercent",
		],
	},
	amulet: {
		prefixes: [
			"healthFlat",
			"physicalDamageFlatGlobal",
			"globalPhysicalDamageIncrease",
			"globalSpellDamageIncrease",
			"lifeGainOnHitFlat",
			// Mage-flavor: restrictedToImplicitMod "intelligenceFlat" narrows
			// these to lapis_amulet only — epic gold/jade/amber amulets are
			// eligibility-filtered out.
			"tomeGainAsExtraCold",
			"tomeGainAsExtraFire",
			"tomeGainAsExtraLightning",
			"tomeGainAsExtraVoid",
		],
		suffixes: [
			"coldResistance",
			"fireResistance",
			"lightningResistance",
			"voidResistance",
			"strengthFlat",
			"dexterityFlat",
			"intelligenceFlat",
			"criticalStrikeMultiplierFlat",
		],
	},
} satisfies Record<EpicArchetype, EpicModPattern>;

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
		if (chance(0.5)) {
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

	const availableSet: Set<string> = new Set(availableModifiers);

	const getEligible = (affixType: "prefix" | "suffix"): ModifierId[] => {
		// Epic: draw from the archetype pool, but intersect with the template's
		// real eligibility so applicableTo / restrictedToArmorType /
		// restrictedToImplicitMod are honored at epic rarity too.
		if (epicPattern) {
			const pool =
				affixType === "prefix" ? epicPattern.prefixes : epicPattern.suffixes;
			return pool.filter((modId) => {
				if (usedModIds.has(modId)) return false;
				if (!availableSet.has(modId)) return false;
				return tierCache.has(modId);
			});
		}
		return availableModifiers.filter((modId) => {
			if (usedModIds.has(modId)) return false;
			const mod = getModifier(modId);
			if (mod.affixType !== affixType) return false;
			return tierCache.has(modId);
		});
	};

	const rollMod = (affixType: "prefix" | "suffix"): boolean => {
		const eligible = getEligible(affixType);
		if (eligible.length === 0) return false;

		const modId = pickWeighted(eligible, (id) => {
			const m = getModifier(id);
			return getSynergyWeight(
				m.weight ?? DEFAULT_MODIFIER_WEIGHT,
				m.tags ?? [],
				rolledTags,
				synergyMultiplier,
			);
		});
		const mod = getModifier(modId);
		let tier = tierCache.get(modId)!;

		// Epic: clamp to minimum tier 4 (lower number = better, so use Math.min)
		if (isEpic && tier.tier > EPIC_MIN_TIER) {
			// Find tier 4 for this modifier
			const modDef = getModifier(modId);
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

export function computeWeaponStats(
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
		const spellElement = SPELL_FLAT_TO_ELEMENT.get(mod.modifierId);
		if (spellElement) {
			elementalDamage.push({
				element: spellElement,
				min: mod.minValue ?? mod.value,
				max: mod.maxValue ?? mod.value,
			});
			continue;
		}

		const modifier = findModifier(mod.modifierId);
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
			case "defense":
			case "blockChance":
				// Armor targets: computeArmorStats applies them.
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
	armorType: ArmorType | undefined,
	explicits: RolledMod[],
	implicits: RolledImplicit[] = [],
): ComputedDefenseStats | undefined {
	const defenseInfo = armorType ? DEFENSE_LABELS[armorType] : null;

	let flatBonus = 0;
	let defenseIncrease = 0;
	let blockAdditive = 0;

	const accumulate = (mod: RolledImplicit | RolledMod) => {
		if (!mod.modifierId) return;
		const modifier = findModifier(mod.modifierId);
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
		result[defenseInfo.stat] = value;
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
		id: randomId(),
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
