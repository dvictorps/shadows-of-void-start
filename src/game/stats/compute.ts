import { m } from "#/paraglide/messages";

import { attunementLevelBonus } from "../classes/attunement";
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
import {
	DEFAULT_WEAPON_ATTACK_SPEED,
	DEFAULT_WEAPON_CRIT_CHANCE,
	type GeneratedItem,
	type RolledMod,
} from "../items/types";
import { hasOwnKey } from "../typed-object";
import type {
	ComputedCharacterStats,
	EquippedItem,
	IncreasedPools,
	SelectableElement,
	StatEngineInput,
	SwingProfile,
} from "./types";

const RESISTANCE_CAP = 75;
const BLOCK_CHANCE_CAP = 75;
const ARMOR_REDUCTION_CAP = 85;
const HIT_CHANCE_MIN = 0.05;
const HIT_CHANCE_MAX = 0.95;

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

type ModApplier = (
	stats: ComputedCharacterStats,
	pcts: DefensePcts,
	v: number,
) => void;

const MOD_APPLIERS = {
	strengthFlat: (s, _p, v) => {
		s.attributes.strength += v;
	},
	dexterityFlat: (s, _p, v) => {
		s.attributes.dexterity += v;
	},
	intelligenceFlat: (s, _p, v) => {
		s.attributes.intelligence += v;
	},
	allAttributesFlat: (s, _p, v) => {
		s.attributes.strength += v;
		s.attributes.dexterity += v;
		s.attributes.intelligence += v;
	},

	healthFlat: (s, _p, v) => {
		s.maxLife += v;
	},
	manaFlat: (s, _p, v) => {
		s.maxMana += v;
	},
	healthRegenFlat: (s, _p, v) => {
		s.lifeRegen += v;
	},
	manaRegenFlat: (s, _p, v) => {
		s.manaRegen += v;
	},

	coldResistance: (s, _p, v) => {
		s.resistances.cold += v;
	},
	fireResistance: (s, _p, v) => {
		s.resistances.fire += v;
	},
	lightningResistance: (s, _p, v) => {
		s.resistances.lightning += v;
	},
	voidResistance: (s, _p, v) => {
		s.resistances.void += v;
	},

	armorFlat: (s, _p, v) => {
		s.armor += v;
	},
	evasionFlat: (s, _p, v) => {
		s.evasion += v;
	},
	barrierFlat: (s, _p, v) => {
		s.maxBarrier += v;
	},
	accuracyFlat: (s, _p, v) => {
		s.accuracy += v;
	},
	thornsDamageFlat: (s, _p, v) => {
		s.thorns += v;
	},
	globalArmorIncrease: (_s, p, v) => {
		p.armor += v;
	},
	globalEvasionIncrease: (_s, p, v) => {
		p.evasion += v;
	},
	globalBarrierIncrease: (_s, p, v) => {
		p.barrier += v;
	},

	globalPhysicalDamageIncrease: (s, _p, v) => {
		s.increased.physical += v;
	},
	globalColdDamageIncrease: (s, _p, v) => {
		s.increased.cold += v;
	},
	globalFireDamageIncrease: (s, _p, v) => {
		s.increased.fire += v;
	},
	globalLightningDamageIncrease: (s, _p, v) => {
		s.increased.lightning += v;
	},
	globalVoidDamageIncrease: (s, _p, v) => {
		s.increased.void += v;
	},
	globalElementalDamageIncrease: (s, _p, v) => {
		s.increased.elementalGlobal += v;
	},
	globalElementalDamageWithAttacksIncrease: (s, _p, v) => {
		s.increased.elementalWithAttacks += v;
	},
	globalMeleeDamageIncrease: (s, _p, v) => {
		s.increased.melee += v;
	},
	globalSpellDamageIncrease: (s, _p, v) => {
		s.increased.spell += v;
	},

	globalAttackSpeedIncrease: (s, _p, v) => {
		s.increased.attackSpeed += v;
	},
	globalCastSpeedIncrease: (s, _p, v) => {
		s.increased.castSpeed += v;
	},

	globalCriticalChanceIncrease: (s, _p, v) => {
		s.increased.criticalChance += v;
	},
	criticalStrikeMultiplierFlat: (s, _p, v) => {
		s.bonusCritMultiplier += v;
	},

	movementSpeedIncrease: (s, _p, v) => {
		s.movementSpeed += v;
	},
	lifeGainOnHitFlat: (s, _p, v) => {
		s.lifeGainOnHit += v;
	},
	manaGainOnHitFlat: (s, _p, v) => {
		s.manaGainOnHit += v;
	},
	lifeOnKillFlat: (s, _p, v) => {
		s.lifeOnKill += v;
	},
	manaOnKillFlat: (s, _p, v) => {
		s.manaOnKill += v;
	},
	lifeLeechPercent: (s, _p, v) => {
		s.lifeLeechPercent += v;
	},

	itemRarityIncreasePrefix: (s, _p, v) => {
		s.magicFind += v;
	},
	itemRarityIncreaseSuffix: (s, _p, v) => {
		s.magicFind += v;
	},

	tomeGainAsExtraCold: (s, _p, v) => {
		s.gainAsExtraSpell.cold += v;
	},
	tomeGainAsExtraFire: (s, _p, v) => {
		s.gainAsExtraSpell.fire += v;
	},
	tomeGainAsExtraLightning: (s, _p, v) => {
		s.gainAsExtraSpell.lightning += v;
	},
	tomeGainAsExtraVoid: (s, _p, v) => {
		s.gainAsExtraSpell.void += v;
	},
} satisfies Record<string, ModApplier>;

function applyModifierValue(
	stats: ComputedCharacterStats,
	pcts: DefensePcts,
	modifierId: string,
	v: number,
): void {
	if (hasOwnKey(MOD_APPLIERS, modifierId)) {
		MOD_APPLIERS[modifierId](stats, pcts, v);
	}
}

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

const FLAT_DAMAGE_MAP: ReadonlyMap<string, keyof GearFlatDamage> = new Map([
	["physicalDamageFlatGlobal", "physical"],
	["coldDamageToAttacksFlat", "cold"],
	["coldDamageToAttacksFlatGlobal", "cold"],
	["fireDamageToAttacksFlat", "fire"],
	["fireDamageToAttacksFlatGlobal", "fire"],
	["lightningDamageToAttacksFlat", "lightning"],
	["lightningDamageToAttacksFlatGlobal", "lightning"],
	["voidDamageToAttacksFlat", "void"],
	["voidDamageToAttacksFlatGlobal", "void"],
]);

function collectGlobalFlatDamage(items: EquippedItem[]): GearFlatDamage {
	const flat = blankGearFlat();
	for (const { item } of items) {
		for (const mod of item.implicits) {
			if (!mod.modifierId) continue;
			const bucket = FLAT_DAMAGE_MAP.get(mod.modifierId);
			if (bucket) flat[bucket] += mod.value;
		}
		for (const mod of item.explicits) {
			const bucket = FLAT_DAMAGE_MAP.get(mod.modifierId);
			if (bucket) flat[bucket] += mod.value;
		}
	}
	return flat;
}

function applyItem(
	stats: ComputedCharacterStats,
	pcts: DefensePcts,
	item: GeneratedItem,
): void {
	for (const imp of item.implicits) {
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

const ELEMENT_DISPLAY_NAME = {
	fire: "Fire",
	cold: "Cold",
	lightning: "Lightning",
} satisfies Record<SelectableElement, string>;

interface BuildSwingOptions {
	selectedElement?: SelectableElement;
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
	const baseAS =
		path === "attack"
			? (cs?.attackSpeed ??
				item.baseStats.attackSpeed ??
				DEFAULT_WEAPON_ATTACK_SPEED)
			: BASE_CAST_SPEED;
	return {
		source,
		itemId: item.id,
		weaponType: item.weaponType ?? "sword",
		...swingDamage(item, gearFlat, path, options),
		baseCritChance:
			cs?.criticalChance ??
			item.baseStats.criticalChance ??
			DEFAULT_WEAPON_CRIT_CHANCE,
		baseAttackSpeed: baseAS,
	};
}

function swingDamage(
	item: GeneratedItem,
	gearFlat: GearFlatDamage,
	path: "attack" | "spell",
	options?: BuildSwingOptions,
): Pick<SwingProfile, "physicalDamage" | "elementalDamage"> {
	const cs = item.computedStats;
	const physBase = cs?.physicalDamage ?? {
		min: item.baseStats.minDamage ?? 1,
		max: item.baseStats.maxDamage ?? 1,
	};
	const weaponElem = cs?.elementalDamage ?? [];
	if (path === "attack") {
		return {
			physicalDamage: {
				min: physBase.min + gearFlat.physical,
				max: physBase.max + gearFlat.physical,
			},
			elementalDamage: addGearFlatToElements(weaponElem, gearFlat),
		};
	}
	const elem = weaponElem.map((e) => ({ ...e }));
	if (!options?.selectedElement) {
		return { physicalDamage: { ...physBase }, elementalDamage: elem };
	}
	convertToElement(
		physBase,
		elem,
		ELEMENT_DISPLAY_NAME[options.selectedElement],
		options.level ?? 1,
	);
	return { physicalDamage: { min: 0, max: 0 }, elementalDamage: elem };
}

function convertToElement(
	phys: SwingProfile["physicalDamage"],
	elem: SwingProfile["elementalDamage"],
	elementName: string,
	level: number,
): void {
	const bonus = attunementLevelBonus(level);
	const convertedMin = phys.min + bonus.min;
	const convertedMax = phys.max + bonus.max;
	const existing = elem.find((e) => e.element === elementName);
	if (existing) {
		existing.min += convertedMin;
		existing.max += convertedMax;
	} else {
		elem.push({ element: elementName, min: convertedMin, max: convertedMax });
	}
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

export function unmetRequirement(
	item: GeneratedItem,
	stats: ComputedCharacterStats,
	level: number,
): string | null {
	const reqs = item.requirements;
	if (!reqs) return null;
	if (reqs.level !== undefined && level < reqs.level)
		return `Level ${reqs.level} required`;
	if (reqs.str !== undefined && stats.attributes.strength < reqs.str)
		return `Strength ${reqs.str} required`;
	if (reqs.dex !== undefined && stats.attributes.dexterity < reqs.dex)
		return `Dexterity ${reqs.dex} required`;
	if (reqs.int !== undefined && stats.attributes.intelligence < reqs.int)
		return `Intelligence ${reqs.int} required`;
	return null;
}

function requirementsMet(
	item: GeneratedItem,
	stats: ComputedCharacterStats,
	level: number,
): boolean {
	return unmetRequirement(item, stats, level) === null;
}

function buildSwings(
	path: ComputedCharacterStats["path"],
	mainHand: GeneratedItem | null,
	offHand: GeneratedItem | null,
	isAttackDW: boolean,
	gearFlat: GearFlatDamage,
	spellOpts: BuildSwingOptions,
): SwingProfile[] {
	if (!mainHand) return [];
	if (path === "attack") {
		const main = buildSwing(mainHand, "mainHand", gearFlat, "attack");
		return isAttackDW && offHand
			? [main, buildSwing(offHand, "offHand", gearFlat, "attack")]
			: [main];
	}
	if (path !== "spell") return [];
	const main = buildSwing(mainHand, "mainHand", gearFlat, "spell", spellOpts);
	return offHand?.weaponType === "wand"
		? [main, buildSwing(offHand, "offHand", gearFlat, "spell", spellOpts)]
		: [main];
}

function tickRateFor(
	stats: ComputedCharacterStats,
	isAttackDW: boolean,
): number {
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
	return averagedBase * speedMultiplier * dwMoreMult;
}

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
	stats.path = determinePath(mainHand, input.classDef?.id);
	const offHandType = offHand?.weaponType;
	const isAttackDW =
		stats.path === "attack" &&
		!!offHand &&
		!!offHandType &&
		ATTACK_WEAPONS.has(offHandType);

	if (isAttackDW) stats.blockChance += DUAL_WIELD_BLOCK_CHANCE_BONUS;
	applyCaps(stats);

	const gearFlat = collectGlobalFlatDamage(
		live.filter(
			(eq) =>
				eq.slot !== "weapon" && !(eq.slot === "offhand" && isWeapon(eq.item)),
		),
	);

	stats.swings = buildSwings(
		stats.path,
		mainHand,
		offHand,
		isAttackDW,
		gearFlat,
		{
			selectedElement: input.selectedElement,
			level: input.level,
		},
	);
	stats.tickRate = tickRateFor(stats, isAttackDW);

	return stats;
}

export function computeCharacterStats(
	input: StatEngineInput,
): ComputedCharacterStats {
	let broken = new Set<string>();
	let stats: ComputedCharacterStats = blankStats();
	const maxIterations = input.equippedItems.length + 1;

	for (let i = 0; i <= maxIterations; i++) {
		const brokenIds = broken;
		const live = input.equippedItems.filter((eq) => !brokenIds.has(eq.item.id));
		stats = computeOnce(input, live);

		const newBroken = new Set(broken);
		for (const eq of input.equippedItems) {
			if (!requirementsMet(eq.item, stats, input.level)) {
				newBroken.add(eq.item.id);
			}
		}

		const mainHandLive = live.find((eq) => eq.slot === "weapon")?.item;
		if (!mainHandLive || !isBow(mainHandLive)) {
			for (const eq of input.equippedItems) {
				if (eq.slot === "offhand" && isQuiver(eq.item)) {
					newBroken.add(eq.item.id);
				}
			}
		}

		if (newBroken.size === broken.size) {
			stats.brokenItemIds = newBroken;
			return stats;
		}
		broken = newBroken;
	}

	stats.brokenItemIds = broken;
	return stats;
}

export interface ArmorMitigation {
	reductionPct: number;
	atReferenceHit: number;
}

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

export function isAttackDualWielding(stats: ComputedCharacterStats): boolean {
	return stats.path === "attack" && stats.swings.length === 2;
}

export function totalCritMultiplier(bonusFromMods: number): number {
	return BASE_CRIT_MULTIPLIER + bonusFromMods;
}

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
			reasons.push(m.broken_missing_level({ value: reqs.level }));
		}
		if (reqs.str !== undefined && totals.attributes.strength < reqs.str) {
			reasons.push(
				m.broken_missing_strength({
					value: reqs.str - totals.attributes.strength,
				}),
			);
		}
		if (reqs.dex !== undefined && totals.attributes.dexterity < reqs.dex) {
			reasons.push(
				m.broken_missing_dexterity({
					value: reqs.dex - totals.attributes.dexterity,
				}),
			);
		}
		if (reqs.int !== undefined && totals.attributes.intelligence < reqs.int) {
			reasons.push(
				m.broken_missing_intelligence({
					value: reqs.int - totals.attributes.intelligence,
				}),
			);
		}
	}
	if (item.equipmentType === "quiver" && mainHandWeaponType !== "bow") {
		reasons.push(m.tooltip_requires_bow_in_main_hand());
	}
	return reasons;
}
