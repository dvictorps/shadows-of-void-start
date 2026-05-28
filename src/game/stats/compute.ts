// ─────────────────────────────────────────────────────────────────────────────
//  Stat engine — turns a character + equipped gear into ComputedCharacterStats.
//  Pure (no React, no Convex); runs on both client and server. The public
//  entry point is `computeCharacterStats`; everything else is internal.
//
//  Sections (grep the headers to jump):
//    ── Caps + weapon-archetype sets ──                  constants only
//    ── Accumulator initialisers ──                      blankStats / blankIncreased
//    ── Apply a single rolled mod ──                     applyModifierValue (the ~40-case switch)
//    ── Per-element flat damage from gear ──             collectGlobalFlatDamage
//    ── Apply one equipped item's contributions ──       applyItem, foldGlobalDefenseIncreases
//    ── Determine combat path ──                         determinePath (attack/spell/unarmed)
//    ── Build a swing profile from a weapon ──           buildSwing, addGearFlatToElements
//    ── Base from class + level ──                       applyBase
//    ── Apply caps and floors ──                         applyCaps (resists 75, block 75, …)
//    ── Requirements check ──                            requirementsMet (level/str/dex/int)
//    ── Single non-iterating pass ──                     computeOnce
//    ── Public: broken-state fixed-point ──              computeCharacterStats  ← entry
//    ── Derived helpers for the UI panel ──              mitigation %, evasion %, DPS, …
//    ── Broken state explanation ──                      describeBrokenReasons  ← UI helper
//
//  Common tasks:
//    • Add a new modifier id          →  applyModifierValue switch + types.ts (if a new field is needed)
//    • Add a stat field on the engine →  blankStats + ComputedCharacterStats in types.ts + the relevant case
//    • Add a broken-state rule        →  the fixed-point loop inside computeCharacterStats
//    • Add flat-to-attacks behaviour  →  collectGlobalFlatDamage + addGearFlatToElements
//    • Change how a swing is damaged  →  see also `damage.ts:rollPlayerSwing`
//    • Add a UI-only derived stat     →  Derived helpers section at the bottom
// ─────────────────────────────────────────────────────────────────────────────

import type {
	CharacterClassDefinition,
	CharacterClassId,
} from "../classes/types";
import {
	BASE_CAST_SPEED,
	BASE_CRIT_MULTIPLIER,
	CRIT_CHANCE_CAP,
	CRIT_CHANCE_FLOOR,
	DUAL_WIELD_AS_MORE_MULT,
	DUAL_WIELD_BLOCK_CHANCE_BONUS,
} from "../combat/constants";
import { isBow, isQuiver, isWeapon } from "../items/equipment";
import type { GeneratedItem, RolledMod } from "../items/types";
import type {
	ComputedCharacterStats,
	EquippedItem,
	IncreasedPools,
	StatEngineInput,
	SwingProfile,
} from "./types";

// ── Caps + weapon-archetype sets ──

const RESISTANCE_CAP = 75;
const BLOCK_CHANCE_CAP = 75;
const ARMOR_REDUCTION_CAP = 85;
const HIT_CHANCE_MIN = 0.05;
const HIT_CHANCE_MAX = 0.95;

// Attribute → derived stat conversions. Exported so the ShowStatsModal
// tooltip can render the rule without duplicating the magnitude. Keep
// these numbers in sync with the i18n hint strings.
export const STR_MELEE_PCT_PER_POINT = 1;
export const STR_LIFE_PER_POINT = 5;
export const DEX_ACCURACY_PER_POINT = 2;
export const DEX_EVASION_PCT_PER_POINT = 1;
export const INT_BARRIER_PCT_PER_POINT = 1;

const ATTACK_WEAPONS = new Set([
	"sword",
	"dagger",
	"axe",
	"mace",
	"greatsword",
	"twoHandedAxe",
	"bow",
]);
const CASTER_WEAPONS = new Set(["wand", "staff"]);

// ── Accumulator initialisers ──

function blankStats(): ComputedCharacterStats {
	return {
		attributes: { strength: 0, dexterity: 0, intelligence: 0 },
		maxLife: 0,
		lifeRegen: 0,
		maxMana: 0,
		manaRegen: 0,
		maxBarrier: 0,
		armor: 0,
		evasion: 0,
		accuracy: 0,
		blockChance: 0,
		thorns: 0,
		resistances: { cold: 0, fire: 0, lightning: 0, void: 0 },
		path: "unarmed",
		tickRate: 0,
		swings: [],
		increased: blankIncreased(),
		bonusCritMultiplier: 0,
		movementSpeed: 0,
		lifeGainOnHit: 0,
		manaGainOnHit: 0,
		lifeOnKill: 0,
		manaOnKill: 0,
		lifeLeechPercent: 0,
		magicFind: 0,
		gainAsExtraSpell: { cold: 0, fire: 0, lightning: 0, void: 0 },
		brokenItemIds: new Set(),
	};
}

function blankIncreased(): IncreasedPools {
	return {
		physical: 0,
		cold: 0,
		fire: 0,
		lightning: 0,
		void: 0,
		elementalGlobal: 0,
		elementalWithAttacks: 0,
		melee: 0,
		spell: 0,
		attackSpeed: 0,
		castSpeed: 0,
		criticalChance: 0,
	};
}

// ── Apply a single rolled mod ──
//
// The global defense % mods (armorIncrease / evasionIncrease / barrierIncrease)
// need to be applied AFTER all flat values are summed, so we route them into
// a separate scratch object the caller folds in at the end. This keeps the
// pass single-iteration.

interface DefensePcts {
	armor: number;
	evasion: number;
	barrier: number;
}

function applyMod(
	stats: ComputedCharacterStats,
	pcts: DefensePcts,
	mod: RolledMod,
): void {
	applyModifierValue(stats, pcts, mod.modifierId, mod.value);
}

// Shared switch for any modifier-id-based stat application. Used by `applyMod`
// (explicits) and `applyImplicit` (template implicits) so the engine handles
// both through identical machinery — adding a new id only touches one place.
function applyModifierValue(
	stats: ComputedCharacterStats,
	pcts: DefensePcts,
	modifierId: string,
	v: number,
): void {
	switch (modifierId) {
		// Attributes
		case "strengthFlat":
			stats.attributes.strength += v;
			return;
		case "dexterityFlat":
			stats.attributes.dexterity += v;
			return;
		case "intelligenceFlat":
			stats.attributes.intelligence += v;
			return;
		case "allAttributesFlat":
			stats.attributes.strength += v;
			stats.attributes.dexterity += v;
			stats.attributes.intelligence += v;
			return;

		// Life / mana
		case "healthFlat":
			stats.maxLife += v;
			return;
		case "manaFlat":
			stats.maxMana += v;
			return;
		case "healthRegenFlat":
			stats.lifeRegen += v;
			return;
		case "manaRegenFlat":
			stats.manaRegen += v;
			return;

		// Resistances
		case "coldResistance":
			stats.resistances.cold += v;
			return;
		case "fireResistance":
			stats.resistances.fire += v;
			return;
		case "lightningResistance":
			stats.resistances.lightning += v;
			return;
		case "voidResistance":
			stats.resistances.void += v;
			return;

		// Global defenses
		case "armorFlat":
			stats.armor += v;
			return;
		case "evasionFlat":
			stats.evasion += v;
			return;
		case "barrierFlat":
			stats.maxBarrier += v;
			return;
		case "accuracyFlat":
			stats.accuracy += v;
			return;
		case "thornsDamageFlat":
			stats.thorns += v;
			return;
		case "blockChanceIncrease":
			// Baked into the shield's computedDefenseStats.blockChance — must
			// stay out of the global accumulator to avoid double-count.
			return;

		case "globalArmorIncrease":
			pcts.armor += v;
			return;
		case "globalEvasionIncrease":
			pcts.evasion += v;
			return;
		case "globalBarrierIncrease":
			pcts.barrier += v;
			return;

		// Global damage increased
		case "globalPhysicalDamageIncrease":
			stats.increased.physical += v;
			return;
		case "globalColdDamageIncrease":
			stats.increased.cold += v;
			return;
		case "globalFireDamageIncrease":
			stats.increased.fire += v;
			return;
		case "globalLightningDamageIncrease":
			stats.increased.lightning += v;
			return;
		case "globalVoidDamageIncrease":
			stats.increased.void += v;
			return;
		case "globalElementalDamageIncrease":
			stats.increased.elementalGlobal += v;
			return;
		case "globalElementalDamageWithAttacksIncrease":
			stats.increased.elementalWithAttacks += v;
			return;
		case "globalMeleeDamageIncrease":
			stats.increased.melee += v;
			return;
		case "globalSpellDamageIncrease":
			stats.increased.spell += v;
			return;

		// Speed
		case "globalAttackSpeedIncrease":
			stats.increased.attackSpeed += v;
			return;
		case "globalCastSpeedIncrease":
			stats.increased.castSpeed += v;
			return;

		// Crit
		case "globalCriticalChanceIncrease":
			stats.increased.criticalChance += v;
			return;
		case "criticalStrikeMultiplierFlat":
			stats.bonusCritMultiplier += v;
			return;

		// Flat damage to attacks — these are summed into a per-element pool but
		// physically attached to attack swings. We store them on the increased
		// pool's host so the swing builder can read them later.
		// To keep types clean, we route them through dedicated fields below.
		case "physicalDamageFlatGlobal":
		case "coldDamageToAttacksFlat":
		case "fireDamageToAttacksFlat":
		case "lightningDamageToAttacksFlat":
		case "voidDamageToAttacksFlat":
		case "coldDamageToAttacksFlatGlobal":
		case "fireDamageToAttacksFlatGlobal":
		case "lightningDamageToAttacksFlatGlobal":
		case "voidDamageToAttacksFlatGlobal":
			// Handled in collectGlobalFlatDamage during swing assembly.
			return;

		// Flat damage to spells — only rolls on caster weapons; folded into the
		// weapon's computed stats already, NOT into character globals.
		case "coldDamageFlat":
		case "fireDamageFlat":
		case "lightningDamageFlat":
		case "voidDamageFlat":
			return;

		// Utility
		case "movementSpeedIncrease":
			stats.movementSpeed += v;
			return;
		case "lifeGainOnHitFlat":
			stats.lifeGainOnHit += v;
			return;
		case "manaGainOnHitFlat":
			stats.manaGainOnHit += v;
			return;
		case "lifeOnKillFlat":
			stats.lifeOnKill += v;
			return;
		case "manaOnKillFlat":
			stats.manaOnKill += v;
			return;
		case "lifeLeechPercent":
			stats.lifeLeechPercent += v;
			return;

		// MF (prefix + suffix variants both feed magicFind)
		case "itemRarityIncreasePrefix":
		case "itemRarityIncreaseSuffix":
			stats.magicFind += v;
			return;

		case "tomeGainAsExtraCold":
			stats.gainAsExtraSpell.cold += v;
			return;
		case "tomeGainAsExtraFire":
			stats.gainAsExtraSpell.fire += v;
			return;
		case "tomeGainAsExtraLightning":
			stats.gainAsExtraSpell.lightning += v;
			return;
		case "tomeGainAsExtraVoid":
			stats.gainAsExtraSpell.void += v;
			return;

		// Filler / reserved
		case "stunDurationIncrease":
		case "reducedAttributeRequirements":
			return;
	}
}

// ── Per-element flat damage from gear (attack path) ──

interface GearFlatDamage {
	physical: number;
	cold: number;
	fire: number;
	lightning: number;
	void: number;
}

function blankGearFlat(): GearFlatDamage {
	return { physical: 0, cold: 0, fire: 0, lightning: 0, void: 0 };
}

// Modifier id → which element bucket it feeds. The `*ToAttacksFlat` ids are
// the local-to-weapon variants (kept here as a no-op safety net — weapons are
// filtered out at the call site, so they never reach this map in practice).
// The `*ToAttacksFlatGlobal` ids are the global versions that roll on
// rings/amulet/gloves/quiver.
const FLAT_DAMAGE_MAP: Record<string, keyof GearFlatDamage> = {
	physicalDamageFlatGlobal: "physical",
	coldDamageToAttacksFlat: "cold",
	coldDamageToAttacksFlatGlobal: "cold",
	fireDamageToAttacksFlat: "fire",
	fireDamageToAttacksFlatGlobal: "fire",
	lightningDamageToAttacksFlat: "lightning",
	lightningDamageToAttacksFlatGlobal: "lightning",
	voidDamageToAttacksFlat: "void",
	voidDamageToAttacksFlatGlobal: "void",
};

function collectGlobalFlatDamage(items: EquippedItem[]): GearFlatDamage {
	const flat = blankGearFlat();
	for (const { item } of items) {
		for (const mod of item.implicits) {
			if (!mod.modifierId) continue;
			const bucket = FLAT_DAMAGE_MAP[mod.modifierId];
			if (bucket) flat[bucket] += mod.value;
		}
		for (const mod of item.explicits) {
			const bucket = FLAT_DAMAGE_MAP[mod.modifierId];
			if (bucket) flat[bucket] += mod.value;
		}
	}
	return flat;
}

// ── Apply one equipped item's contributions ──
// Flat-to-attacks is layered onto swings (see collectGlobalFlatDamage), not
// character totals. Local computed defense was already baked by the generator.

function applyItem(
	stats: ComputedCharacterStats,
	pcts: DefensePcts,
	item: GeneratedItem,
): void {
	for (const imp of item.implicits) {
		// Legacy items pre-implicit-wiring carry no modifierId — skip them; they
		// remain display-only until the player swaps to a freshly-rolled item.
		if (imp.modifierId) {
			applyModifierValue(stats, pcts, imp.modifierId, imp.value);
		}
	}
	for (const mod of item.explicits) applyMod(stats, pcts, mod);

	const def = item.computedDefenseStats;
	if (def) {
		if (def.armor) stats.armor += def.armor;
		if (def.evasion) stats.evasion += def.evasion;
		if (def.barrier) stats.maxBarrier += def.barrier;
		if (def.blockChance) stats.blockChance += def.blockChance;
	}
}

// Folded in AFTER gear-driven mods so attribute totals are final. % bonuses
// ride on `pcts` so the existing global-defense fold below applies them in
// one pass alongside gear-rolled % defenses.
function applyAttributeBonuses(
	stats: ComputedCharacterStats,
	pcts: DefensePcts,
): void {
	const a = stats.attributes;
	if (a.strength > 0) {
		stats.increased.melee += a.strength * STR_MELEE_PCT_PER_POINT;
		stats.maxLife += a.strength * STR_LIFE_PER_POINT;
	}
	if (a.dexterity > 0) {
		stats.accuracy += a.dexterity * DEX_ACCURACY_PER_POINT;
		pcts.evasion += a.dexterity * DEX_EVASION_PCT_PER_POINT;
	}
	if (a.intelligence > 0)
		pcts.barrier += a.intelligence * INT_BARRIER_PCT_PER_POINT;
}

function foldGlobalDefenseIncreases(
	stats: ComputedCharacterStats,
	pcts: DefensePcts,
): void {
	if (pcts.armor > 0)
		stats.armor = Math.round(stats.armor * (1 + pcts.armor / 100));
	if (pcts.evasion > 0)
		stats.evasion = Math.round(stats.evasion * (1 + pcts.evasion / 100));
	if (pcts.barrier > 0)
		stats.maxBarrier = Math.round(stats.maxBarrier * (1 + pcts.barrier / 100));
}

// ── Determine combat path from main-hand weapon ──

function determinePath(
	mainHand: GeneratedItem | null,
	classId: CharacterClassId | undefined,
): "attack" | "spell" | "unarmed" {
	if (!mainHand) return "unarmed";
	const wt = mainHand.weaponType;
	if (!wt) return "unarmed";
	if (CASTER_WEAPONS.has(wt) && classId === "mage") return "spell";
	return "attack";
}

// ── Build a swing profile from a weapon ──

const ELEMENT_DISPLAY_NAME: Record<"fire" | "cold" | "lightning", string> = {
	fire: "Fire",
	cold: "Cold",
	lightning: "Lightning",
};

interface BuildSwingOptions {
	selectedElement?: "fire" | "cold" | "lightning";
	level?: number;
}

function buildSwing(
	item: GeneratedItem,
	source: "mainHand" | "offHand",
	gearFlat: GearFlatDamage,
	path: "attack" | "spell",
	options?: BuildSwingOptions,
): SwingProfile {
	const cs = item.computedStats;
	const physBase = cs?.physicalDamage ?? {
		min: item.baseStats.minDamage ?? 1,
		max: item.baseStats.maxDamage ?? 1,
	};
	let phys =
		path === "attack"
			? {
					min: physBase.min + gearFlat.physical,
					max: physBase.max + gearFlat.physical,
				}
			: { ...physBase };
	const weaponElem = cs?.elementalDamage ?? [];
	const elem: SwingProfile["elementalDamage"] =
		path === "attack"
			? addGearFlatToElements(weaponElem, gearFlat)
			: weaponElem.map((e) => ({ ...e }));
	const baseAS =
		path === "attack"
			? (cs?.attackSpeed ?? item.baseStats.attackSpeed ?? 1.0)
			: BASE_CAST_SPEED;

	if (path === "spell" && options?.selectedElement) {
		const elementName = ELEMENT_DISPLAY_NAME[options.selectedElement];
		const lvl = options.level ?? 1;
		const convertedMin = phys.min + lvl;
		const convertedMax = phys.max + lvl * 2;

		const existing = elem.find((e) => e.element === elementName);
		if (existing) {
			existing.min += convertedMin;
			existing.max += convertedMax;
		} else {
			elem.push({ element: elementName, min: convertedMin, max: convertedMax });
		}
		phys = { min: 0, max: 0 };
	}

	return {
		source,
		itemId: item.id,
		weaponType: item.weaponType ?? "sword",
		physicalDamage: phys,
		elementalDamage: elem,
		baseCritChance: cs?.criticalChance ?? item.baseStats.criticalChance ?? 5,
		baseAttackSpeed: baseAS,
	};
}

function addGearFlatToElements(
	weaponElements: SwingProfile["elementalDamage"],
	gearFlat: GearFlatDamage,
): SwingProfile["elementalDamage"] {
	const byElem = new Map<string, { min: number; max: number }>();
	for (const e of weaponElements)
		byElem.set(e.element, { min: e.min, max: e.max });
	for (const [element, amount] of [
		["Cold", gearFlat.cold],
		["Fire", gearFlat.fire],
		["Lightning", gearFlat.lightning],
		["Void", gearFlat.void],
	] as const) {
		if (amount > 0) {
			const cur = byElem.get(element) ?? { min: 0, max: 0 };
			byElem.set(element, { min: cur.min + amount, max: cur.max + amount });
		}
	}
	return Array.from(byElem.entries()).map(([element, range]) => ({
		element,
		min: range.min,
		max: range.max,
	}));
}

// ── Base from class + level (no equipment) ──

function applyBase(
	stats: ComputedCharacterStats,
	classDef: CharacterClassDefinition | null,
	level: number,
): void {
	if (classDef) {
		stats.attributes.strength += classDef.baseStats.attributes.strength;
		stats.attributes.dexterity += classDef.baseStats.attributes.dexterity;
		stats.attributes.intelligence += classDef.baseStats.attributes.intelligence;
		stats.maxBarrier += classDef.baseStats.barrier;
	}
	const baseHp = classDef?.baseStats.hp ?? 50;
	stats.maxLife += baseHp + Math.max(0, level - 1) * 10;
}

// ── Apply caps and floors after all sums ──

function applyCaps(stats: ComputedCharacterStats): void {
	const r = stats.resistances;
	r.cold = Math.min(RESISTANCE_CAP, Math.max(-100, r.cold));
	r.fire = Math.min(RESISTANCE_CAP, Math.max(-100, r.fire));
	r.lightning = Math.min(RESISTANCE_CAP, Math.max(-100, r.lightning));
	r.void = Math.min(RESISTANCE_CAP, Math.max(-100, r.void));
	stats.blockChance = Math.min(
		BLOCK_CHANCE_CAP,
		Math.max(0, stats.blockChance),
	);
}

// ── Requirements check ──

function requirementsMet(
	item: GeneratedItem,
	stats: ComputedCharacterStats,
	level: number,
): boolean {
	const reqs = item.requirements;
	if (!reqs) return true;
	if (reqs.level !== undefined && level < reqs.level) return false;
	if (reqs.str !== undefined && stats.attributes.strength < reqs.str)
		return false;
	if (reqs.dex !== undefined && stats.attributes.dexterity < reqs.dex)
		return false;
	if (reqs.int !== undefined && stats.attributes.intelligence < reqs.int)
		return false;
	return true;
}

// ── Single non-iterating pass given a fixed set of "live" items ──

function computeOnce(
	input: StatEngineInput,
	live: EquippedItem[],
): ComputedCharacterStats {
	const stats = blankStats();
	const pcts: DefensePcts = { armor: 0, evasion: 0, barrier: 0 };
	applyBase(stats, input.classDef, input.level);
	for (const eq of live) applyItem(stats, pcts, eq.item);
	applyAttributeBonuses(stats, pcts);
	foldGlobalDefenseIncreases(stats, pcts);

	const mainHand = live.find((eq) => eq.slot === "weapon")?.item ?? null;
	const offHand = live.find((eq) => eq.slot === "offhand")?.item ?? null;
	stats.path = determinePath(
		mainHand,
		input.classDef?.id as CharacterClassId | undefined,
	);
	const offHandType = offHand?.weaponType;
	// Source of truth for "is this attack dual-wielding?". The public
	// `isAttackDualWielding(stats)` helper below re-derives the same answer from
	// `path` + `swings.length` for UI consumers; both must agree.
	const isAttackDW =
		stats.path === "attack" &&
		!!offHand &&
		!!offHandType &&
		ATTACK_WEAPONS.has(offHandType);

	// Apply DW block bonus before applyCaps so the 75% cap runs once.
	if (isAttackDW) stats.blockChance += DUAL_WIELD_BLOCK_CHANCE_BONUS;
	applyCaps(stats);

	// Filter out the swinging weapons — their local flat-to-attacks is already
	// baked into `computedStats` and consumed by buildSwing. Off-hand items
	// that aren't weapons (shield/tome/quiver) DO contribute via the global
	// flat mod pool — most notably the quiver, which carries those mods as
	// its identity.
	const gearFlat = collectGlobalFlatDamage(
		live.filter(
			(eq) =>
				eq.slot !== "weapon" && !(eq.slot === "offhand" && isWeapon(eq.item)),
		),
	);

	if (stats.path === "attack" && mainHand) {
		stats.swings.push(buildSwing(mainHand, "mainHand", gearFlat, "attack"));
		if (isAttackDW && offHand) {
			stats.swings.push(buildSwing(offHand, "offHand", gearFlat, "attack"));
		}
	} else if (stats.path === "spell" && mainHand) {
		const spellOpts: BuildSwingOptions = {
			selectedElement: input.selectedElement,
			level: input.level,
		};
		stats.swings.push(
			buildSwing(mainHand, "mainHand", gearFlat, "spell", spellOpts),
		);
		// Staves are 2H and can't sit in the off-hand slot — only wand+wand.
		// Caster dual-wield gets no implicits.
		if (offHand && offHandType === "wand") {
			stats.swings.push(
				buildSwing(offHand, "offHand", gearFlat, "spell", spellOpts),
			);
		}
	}

	const speedMultiplier =
		stats.path === "spell"
			? 1 + stats.increased.castSpeed / 100
			: 1 + stats.increased.attackSpeed / 100;
	const swingCount = stats.swings.length;
	const averagedBase =
		swingCount > 0
			? stats.swings.reduce((sum, s) => sum + s.baseAttackSpeed, 0) / swingCount
			: 0;
	const dwMoreMult = isAttackDW ? DUAL_WIELD_AS_MORE_MULT : 1;
	stats.tickRate = averagedBase * speedMultiplier * dwMoreMult;

	return stats;
}

// ── Public: broken-state fixed-point ──

export function computeCharacterStats(
	input: StatEngineInput,
): ComputedCharacterStats {
	let broken = new Set<string>();
	let stats: ComputedCharacterStats = blankStats();
	const maxIterations = input.equippedItems.length + 1;

	for (let i = 0; i <= maxIterations; i++) {
		const live = input.equippedItems.filter((eq) => !broken.has(eq.item.id));
		stats = computeOnce(input, live);

		const newBroken = new Set(broken);
		for (const eq of input.equippedItems) {
			if (!requirementsMet(eq.item, stats, input.level)) {
				newBroken.add(eq.item.id);
			}
		}

		// Folds into the same fixed-point cascade as attribute requirements:
		// a quiver whose bow becomes broken (and thus excluded from `live`)
		// breaks too.
		const mainHandLive = live.find((eq) => eq.slot === "weapon")?.item;
		if (!mainHandLive || !isBow(mainHandLive)) {
			for (const eq of input.equippedItems) {
				if (eq.slot === "offhand" && isQuiver(eq.item)) {
					newBroken.add(eq.item.id);
				}
			}
		}

		if (newBroken.size === broken.size) {
			// Stable — no new breaks this round.
			stats.brokenItemIds = newBroken;
			return stats;
		}
		broken = newBroken;
	}

	stats.brokenItemIds = broken;
	return stats;
}

// ── Derived helpers for the UI panel ──

export interface ArmorMitigation {
	reductionPct: number;
	atReferenceHit: number;
}

// PoE-style armor mitigation is hit-size-relative: the same armor pool
// shaves a much bigger % off a 5-damage hit than off a 500-damage hit.
// The stats panel asks for a reference hit size (typical incoming attack
// at the player's expected encounter level) and returns the reduction
// against it. See applyArmor in src/game/combat/damage.ts.
export function computeArmorMitigation(
	armor: number,
	referenceHit: number,
): ArmorMitigation {
	const hit = Math.max(1, referenceHit);
	const raw = (armor / (armor + 10 * hit)) * 100;
	const capped = Math.min(ARMOR_REDUCTION_CAP, Math.max(0, raw));
	return { reductionPct: capped, atReferenceHit: hit };
}

export interface EvasionAvoid {
	avoidPct: number;
	vsEnemyAccuracy: number;
}

export function computeEvasionAvoid(
	evasion: number,
	enemyAccuracy: number,
): EvasionAvoid {
	const hitChance = enemyAccuracy / (enemyAccuracy + evasion / 4);
	const clamped = Math.min(HIT_CHANCE_MAX, Math.max(HIT_CHANCE_MIN, hitChance));
	return { avoidPct: (1 - clamped) * 100, vsEnemyAccuracy: enemyAccuracy };
}

export function effectiveCritChance(
	weaponCrit: number,
	globalIncrease: number,
): number {
	const raw = weaponCrit * (1 + globalIncrease / 100);
	return Math.min(CRIT_CHANCE_CAP, Math.max(CRIT_CHANCE_FLOOR, raw));
}

// Mirrors the internal `isAttackDW` check inside `computeOnce` — the engine
// guarantees `swings.length === 2` iff attack DW is active, so this derives
// the same answer for UI without re-reading the equipped items.
export function isAttackDualWielding(stats: ComputedCharacterStats): boolean {
	return stats.path === "attack" && stats.swings.length === 2;
}

export function totalCritMultiplier(bonusFromMods: number): number {
	return BASE_CRIT_MULTIPLIER + bonusFromMods;
}

// ── Broken state explanation ──

/**
 * For a broken item, returns short Portuguese descriptions of every
 * requirement currently unmet against the supplied totals. Empty if the
 * item is actually fine (caller should still gate on brokenItemIds).
 */
export function describeBrokenReasons(
	item: {
		equipmentType?: string;
		requirements?:
			| { level?: number; str?: number; dex?: number; int?: number }
			| undefined;
	},
	totals: ComputedCharacterStats,
	characterLevel: number,
	mainHandWeaponType?: string,
): string[] {
	const reasons: string[] = [];
	const reqs = item.requirements;
	if (reqs) {
		if (reqs.level !== undefined && characterLevel < reqs.level) {
			reasons.push(`Falta nível ${reqs.level}`);
		}
		if (reqs.str !== undefined && totals.attributes.strength < reqs.str) {
			reasons.push(`Falta ${reqs.str - totals.attributes.strength} de Força`);
		}
		if (reqs.dex !== undefined && totals.attributes.dexterity < reqs.dex) {
			reasons.push(
				`Falta ${reqs.dex - totals.attributes.dexterity} de Destreza`,
			);
		}
		if (reqs.int !== undefined && totals.attributes.intelligence < reqs.int) {
			reasons.push(
				`Falta ${reqs.int - totals.attributes.intelligence} de Inteligência`,
			);
		}
	}
	if (item.equipmentType === "quiver" && mainHandWeaponType !== "bow") {
		reasons.push("Requer Arco na Mão Principal");
	}
	return reasons;
}
