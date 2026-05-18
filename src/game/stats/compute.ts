import type { CharacterClassDefinition } from "../classes/types";
import { BASE_CAST_SPEED } from "../combat/constants";
import type { GeneratedItem, RolledMod } from "../items/types";
import { computeMaxHp } from "../progression/levels";
import type {
	ComputedCharacterStats,
	EquippedItem,
	IncreasedPools,
	StatEngineInput,
	SwingProfile,
} from "./types";

// ── Caps ──

const RESISTANCE_CAP = 75;
const CRIT_CHANCE_CAP = 100;
const CRIT_CHANCE_FLOOR = 5;
const ARMOR_REDUCTION_CAP = 85;
const HIT_CHANCE_MIN = 0.05;
const HIT_CHANCE_MAX = 0.95;
const BASE_CRIT_MULTIPLIER = 50;

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

// ── Mutable accumulator used during a single pass ──

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
		universal: 0,
		attackSpeed: 0,
		castSpeed: 0,
		criticalChance: 0,
	};
}

// ── Apply a single rolled mod to the accumulator ──

function applyMod(stats: ComputedCharacterStats, mod: RolledMod): void {
	const v = mod.value;
	switch (mod.modifierId) {
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
			// Block chance "increased" rolls as an additive percentage value on
			// the shield's base block (handled below in item contribution when
			// the shield is the source). Global accumulator gets the raw add.
			stats.blockChance += v;
			return;

		// Global increased pools
		case "globalArmorIncrease":
			// Armor% applies to the cumulative flat armor — fold it post-sum.
			// Stored on the increased pool intentionally so we can apply once.
			// Use a dedicated key — we treat it as a post-process below.
			return;
		case "globalEvasionIncrease":
			return;
		case "globalBarrierIncrease":
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

function collectGlobalFlatDamage(items: EquippedItem[]): GearFlatDamage {
	const flat = blankGearFlat();
	for (const { item } of items) {
		// Flat-to-attacks only rolls on rings/amulet/gloves; never on the
		// swinging weapon itself (weapon's flat is in computedStats).
		for (const mod of item.explicits) {
			if (mod.modifierId === "physicalDamageFlatGlobal") {
				flat.physical += mod.value;
			} else if (mod.modifierId === "coldDamageToAttacksFlat") {
				flat.cold += mod.value;
			} else if (mod.modifierId === "fireDamageToAttacksFlat") {
				flat.fire += mod.value;
			} else if (mod.modifierId === "lightningDamageToAttacksFlat") {
				flat.lightning += mod.value;
			} else if (mod.modifierId === "voidDamageToAttacksFlat") {
				flat.void += mod.value;
			}
		}
	}
	return flat;
}

// ── Apply one equipped item's contributions (excluding flat-to-attacks, which
//   is layered onto swings, not character totals) ──

function applyItem(stats: ComputedCharacterStats, item: GeneratedItem): void {
	for (const mod of item.explicits) applyMod(stats, mod);

	// Implicits don't carry a modifierId so they can't go through applyMod.
	// They're text-described; numerical contributions live in the explicit pool.
	// Future: structured implicits can fold here.

	// Local computed defense (already includes localDefenseIncrease/Flat)
	const def = item.computedDefenseStats;
	if (def) {
		if (def.armor) stats.armor += def.armor;
		if (def.evasion) stats.evasion += def.evasion;
		if (def.barrier) stats.maxBarrier += def.barrier;
		if (def.blockChance) stats.blockChance += def.blockChance;
	}
}

// ── Global defense % multipliers — applied after flat sums ──

function applyGlobalDefenseIncreases(
	stats: ComputedCharacterStats,
	items: EquippedItem[],
): void {
	let armorPct = 0;
	let evasionPct = 0;
	let barrierPct = 0;
	for (const { item } of items) {
		for (const mod of item.explicits) {
			if (mod.modifierId === "globalArmorIncrease") armorPct += mod.value;
			else if (mod.modifierId === "globalEvasionIncrease")
				evasionPct += mod.value;
			else if (mod.modifierId === "globalBarrierIncrease")
				barrierPct += mod.value;
		}
	}
	if (armorPct > 0)
		stats.armor = Math.round(stats.armor * (1 + armorPct / 100));
	if (evasionPct > 0)
		stats.evasion = Math.round(stats.evasion * (1 + evasionPct / 100));
	if (barrierPct > 0)
		stats.maxBarrier = Math.round(stats.maxBarrier * (1 + barrierPct / 100));
}

// ── Determine combat path from main-hand weapon ──

function determinePath(
	mainHand: GeneratedItem | null,
): "attack" | "spell" | "unarmed" {
	if (!mainHand) return "unarmed";
	const wt = mainHand.weaponType;
	if (!wt) return "unarmed";
	if (ATTACK_WEAPONS.has(wt)) return "attack";
	if (CASTER_WEAPONS.has(wt)) return "spell";
	return "unarmed";
}

// ── Build a swing profile from a weapon ──

function buildSwing(
	item: GeneratedItem,
	source: "mainHand" | "offHand",
	gearFlat: GearFlatDamage,
	path: "attack" | "spell",
): SwingProfile {
	const cs = item.computedStats;
	const physBase = cs?.physicalDamage ?? { min: 1, max: 1 };
	// Layer gear flat damage on top of the weapon's own (attack path only —
	// spells never receive flat-to-attacks).
	const phys =
		path === "attack"
			? {
					min: physBase.min + gearFlat.physical,
					max: physBase.max + gearFlat.physical,
				}
			: physBase;
	const weaponElem = cs?.elementalDamage ?? [];
	const elem =
		path === "attack"
			? addGearFlatToElements(weaponElem, gearFlat)
			: weaponElem;
	const baseAS = path === "attack" ? (cs?.attackSpeed ?? 1.0) : BASE_CAST_SPEED;
	return {
		source,
		itemId: item.id,
		physicalDamage: phys,
		elementalDamage: elem,
		baseCritChance: cs?.criticalChance ?? 5,
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
	stats.maxLife += computeMaxHp(classDef, level);
}

// ── Apply caps and floors after all sums ──

function applyCaps(stats: ComputedCharacterStats): void {
	const r = stats.resistances;
	r.cold = Math.min(RESISTANCE_CAP, Math.max(-100, r.cold));
	r.fire = Math.min(RESISTANCE_CAP, Math.max(-100, r.fire));
	r.lightning = Math.min(RESISTANCE_CAP, Math.max(-100, r.lightning));
	r.void = Math.min(RESISTANCE_CAP, Math.max(-100, r.void));
	stats.blockChance = Math.min(75, Math.max(0, stats.blockChance));
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
	applyBase(stats, input.classDef, input.level);
	for (const eq of live) applyItem(stats, eq.item);
	applyGlobalDefenseIncreases(stats, live);
	applyCaps(stats);

	// Swing assembly
	const mainHand = live.find((eq) => eq.slot === "weapon")?.item ?? null;
	const offHand = live.find((eq) => eq.slot === "offhand")?.item ?? null;
	stats.path = determinePath(mainHand);

	const gearFlat = collectGlobalFlatDamage(
		live.filter((eq) => eq.slot !== "weapon" && eq.slot !== "offhand"),
	);

	const offHandType = offHand?.weaponType;
	if (stats.path === "attack" && mainHand) {
		stats.swings.push(buildSwing(mainHand, "mainHand", gearFlat, "attack"));
		if (offHand && offHandType && ATTACK_WEAPONS.has(offHandType)) {
			stats.swings.push(buildSwing(offHand, "offHand", gearFlat, "attack"));
		}
	} else if (stats.path === "spell" && mainHand) {
		stats.swings.push(buildSwing(mainHand, "mainHand", gearFlat, "spell"));
		// Caster dual-wield: only wand+wand. Staves are 2H and can't sit in the
		// off-hand slot, so we only accept "wand" specifically here.
		if (offHand && offHandType === "wand") {
			stats.swings.push(buildSwing(offHand, "offHand", gearFlat, "spell"));
		}
	}

	// Compute combined tick rate from the swings (each weapon at its own pace).
	const speedMultiplier =
		stats.path === "spell"
			? 1 + stats.increased.castSpeed / 100
			: 1 + stats.increased.attackSpeed / 100;
	stats.tickRate = stats.swings.reduce(
		(sum, s) => sum + s.baseAttackSpeed * speedMultiplier,
		0,
	);

	return stats;
}

// ── Public: full computation with broken-state fixed-point ──

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
	atEnemyLevel: number;
}

export function computeArmorMitigation(
	armor: number,
	enemyLevel: number,
): ArmorMitigation {
	const raw = (armor / (armor + 10 * Math.max(1, enemyLevel))) * 100;
	const capped = Math.min(ARMOR_REDUCTION_CAP, Math.max(0, raw));
	return { reductionPct: capped, atEnemyLevel: enemyLevel };
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

export function totalCritMultiplier(bonusFromMods: number): number {
	return BASE_CRIT_MULTIPLIER + bonusFromMods;
}
