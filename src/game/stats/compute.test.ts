import { describe, expect, it } from "vitest";
import { CLASS_DEFINITIONS } from "../classes/data";
import type { GeneratedItem, RolledMod } from "../items/types";
import {
	computeArmorMitigation,
	computeCharacterStats,
	computeEvasionAvoid,
	effectiveCritChance,
	isAttackDualWielding,
} from "./compute";
import type { EquippedItem } from "./types";

function mod(modifierId: string, value: number): RolledMod {
	return {
		modifierId,
		modifierName: modifierId,
		affixType: "prefix",
		modifierType: "flat",
		isGlobalStat: true,
		tier: 1,
		value,
		description: "",
	};
}

function helmet(
	id: string,
	mods: RolledMod[],
	reqs?: GeneratedItem["requirements"],
): GeneratedItem {
	return {
		id,
		templateId: "test_helmet",
		templateName: "Test Helmet",
		equipmentType: "helmet",
		rarity: "rare",
		name: "Test Helmet",
		itemLevel: 10,
		baseStats: {},
		implicits: [],
		explicits: mods,
		requirements: reqs,
	};
}

function sword(
	id: string,
	stats: { min: number; max: number; speed: number; crit: number },
	mods: RolledMod[] = [],
): GeneratedItem {
	return {
		id,
		templateId: "test_sword",
		templateName: "Test Sword",
		equipmentType: "weapon",
		weaponType: "sword",
		rarity: "rare",
		name: "Test Sword",
		itemLevel: 10,
		baseStats: {},
		implicits: [],
		explicits: mods,
		computedStats: {
			physicalDamage: { min: stats.min, max: stats.max },
			elementalDamage: [],
			attackSpeed: stats.speed,
			criticalChance: stats.crit,
		},
	};
}

function bow(id: string): GeneratedItem {
	return {
		id,
		templateId: "test_bow",
		templateName: "Test Bow",
		equipmentType: "weapon",
		weaponType: "bow",
		rarity: "normal",
		name: "Test Bow",
		itemLevel: 10,
		baseStats: {},
		implicits: [],
		explicits: [],
		computedStats: {
			physicalDamage: { min: 5, max: 7 },
			elementalDamage: [],
			attackSpeed: 1.0,
			criticalChance: 5,
		},
	};
}

function quiver(id: string, mods: RolledMod[] = []): GeneratedItem {
	return {
		id,
		templateId: "test_quiver",
		templateName: "Test Quiver",
		equipmentType: "quiver",
		rarity: "rare",
		name: "Test Quiver",
		itemLevel: 10,
		baseStats: {},
		implicits: [],
		explicits: mods,
	};
}

function wand(id: string, cold: { min: number; max: number }): GeneratedItem {
	return {
		id,
		templateId: "test_wand",
		templateName: "Test Wand",
		equipmentType: "weapon",
		weaponType: "wand",
		rarity: "rare",
		name: "Test Wand",
		itemLevel: 10,
		baseStats: {},
		implicits: [],
		explicits: [],
		computedStats: {
			physicalDamage: { min: 1, max: 1 },
			elementalDamage: [{ element: "Cold", min: cold.min, max: cold.max }],
			attackSpeed: 1.0,
			criticalChance: 6,
		},
	};
}

const warrior = CLASS_DEFINITIONS.warrior;
const mage = CLASS_DEFINITIONS.mage;

describe("computeCharacterStats — base", () => {
	it("returns class base attributes when nothing is equipped", () => {
		const stats = computeCharacterStats({
			classDef: warrior,
			level: 1,
			equippedItems: [],
		});
		expect(stats.attributes).toEqual({
			strength: 10,
			dexterity: 5,
			intelligence: 5,
		});
		// 70 class base + 10 Str * 5 life/point = 120.
		expect(stats.maxLife).toBe(120);
		expect(stats.maxBarrier).toBe(0);
		expect(stats.path).toBe("unarmed");
		expect(stats.swings).toHaveLength(0);
	});

	it("scales max life linearly with level (plus Str-from-class contribution)", () => {
		const stats = computeCharacterStats({
			classDef: warrior,
			level: 10,
			equippedItems: [],
		});
		// 70 class base + 9 * 10 from level + 10 Str * 5 = 210.
		expect(stats.maxLife).toBe(70 + 9 * 10 + 10 * 5);
	});

	it("mage starts with class barrier", () => {
		const stats = computeCharacterStats({
			classDef: mage,
			level: 1,
			equippedItems: [],
		});
		// 20 barrier × (1 + 10 INT × 1% / 100) = 20 × 1.10 = 22.
		expect(stats.maxBarrier).toBe(22);
		expect(stats.attributes.intelligence).toBe(10);
	});
});

describe("computeCharacterStats — equipment contributions", () => {
	it("sums attribute flats from an equipped helmet", () => {
		const eq: EquippedItem[] = [
			{ slot: "helmet", item: helmet("h1", [mod("strengthFlat", 12)]) },
		];
		const stats = computeCharacterStats({
			classDef: warrior,
			level: 1,
			equippedItems: eq,
		});
		expect(stats.attributes.strength).toBe(10 + 12);
	});

	it("caps resistances at 75% and floors at -100", () => {
		const eq: EquippedItem[] = [
			{ slot: "helmet", item: helmet("h1", [mod("fireResistance", 90)]) },
			{ slot: "amulet", item: helmet("a1", [mod("coldResistance", 200)]) },
		];
		const stats = computeCharacterStats({
			classDef: warrior,
			level: 1,
			equippedItems: eq,
		});
		expect(stats.resistances.fire).toBe(75);
		expect(stats.resistances.cold).toBe(75);
	});

	it("equipping an attack weapon sets path=attack and emits a main-hand swing", () => {
		const eq: EquippedItem[] = [
			{
				slot: "weapon",
				item: sword("s1", { min: 5, max: 10, speed: 1.5, crit: 8 }),
			},
		];
		const stats = computeCharacterStats({
			classDef: warrior,
			level: 1,
			equippedItems: eq,
		});
		expect(stats.path).toBe("attack");
		expect(stats.swings).toHaveLength(1);
		expect(stats.swings[0].source).toBe("mainHand");
		expect(stats.swings[0].physicalDamage).toEqual({ min: 5, max: 10 });
		expect(stats.tickRate).toBeCloseTo(1.5);
	});

	it("attack dual-wielding averages the two weapons' speeds and applies +10% AS more multiplier", () => {
		const eq: EquippedItem[] = [
			{
				slot: "weapon",
				item: sword("s1", { min: 5, max: 10, speed: 1.5, crit: 8 }),
			},
			{
				slot: "offhand",
				item: sword("s2", { min: 6, max: 12, speed: 1.6, crit: 7 }),
			},
		];
		const stats = computeCharacterStats({
			classDef: warrior,
			level: 1,
			equippedItems: eq,
		});
		expect(stats.swings).toHaveLength(2);
		expect(stats.swings[0].source).toBe("mainHand");
		expect(stats.swings[1].source).toBe("offHand");
		expect(isAttackDualWielding(stats)).toBe(true);
		// avg(1.5, 1.6) × 1.10 = 1.55 × 1.10 = 1.705
		expect(stats.tickRate).toBeCloseTo(1.705);
	});

	it("shield blockChance comes only from computedDefenseStats (no double-count via explicits)", () => {
		// If compute.ts ever re-adds blockChanceIncrease via applyModifierValue
		// this fails — expected 44, would get 44 + 4 = 48.
		const shield: GeneratedItem = {
			id: "test-shield",
			templateId: "test_shield",
			templateName: "Test Shield",
			equipmentType: "offhand",
			armorType: "silk",
			rarity: "rare",
			name: "Test Shield",
			itemLevel: 10,
			baseStats: { barrier: 30, blockChance: 22 },
			implicits: [{ modifierId: "blockChanceIncrease", description: "", value: 18 }],
			explicits: [mod("blockChanceIncrease", 4)],
			computedDefenseStats: { barrier: 30, blockChance: 44 },
		};
		const stats = computeCharacterStats({
			classDef: warrior,
			level: 1,
			equippedItems: [{ slot: "offhand", item: shield }],
		});
		expect(stats.blockChance).toBe(44);
	});

	it("attack dual-wielding grants +10% block chance", () => {
		const eq: EquippedItem[] = [
			{
				slot: "weapon",
				item: sword("s1", { min: 5, max: 10, speed: 1.3, crit: 5 }),
			},
			{
				slot: "offhand",
				item: sword("s2", { min: 5, max: 10, speed: 1.3, crit: 5 }),
			},
		];
		const stats = computeCharacterStats({
			classDef: warrior,
			level: 1,
			equippedItems: eq,
		});
		expect(stats.blockChance).toBe(10);
	});

	it("single attack weapon does NOT receive DW buffs (no block, no AS more multiplier)", () => {
		const eq: EquippedItem[] = [
			{
				slot: "weapon",
				item: sword("s1", { min: 5, max: 10, speed: 1.5, crit: 8 }),
			},
		];
		const stats = computeCharacterStats({
			classDef: warrior,
			level: 1,
			equippedItems: eq,
		});
		expect(isAttackDualWielding(stats)).toBe(false);
		expect(stats.blockChance).toBe(0);
		expect(stats.tickRate).toBeCloseTo(1.5);
	});

	it("caster main hand sets path=spell and tick rate uses base cast speed (1.0)", () => {
		const eq: EquippedItem[] = [
			{ slot: "weapon", item: wand("w1", { min: 4, max: 8 }) },
		];
		const stats = computeCharacterStats({
			classDef: mage,
			level: 1,
			equippedItems: eq,
		});
		expect(stats.path).toBe("spell");
		expect(stats.tickRate).toBe(1.0);
	});

	it("spell flat damage on wand folds into swing as elem alongside converted phys", () => {
		const wandItem: GeneratedItem = {
			id: "spell-flat-wand",
			templateId: "test_wand_phys",
			templateName: "Test Wand Phys",
			equipmentType: "weapon",
			weaponType: "wand",
			rarity: "rare",
			name: "Test Wand Phys",
			itemLevel: 10,
			baseStats: { minDamage: 12, maxDamage: 25, attackSpeed: 1.0, criticalChance: 6 },
			implicits: [],
			explicits: [],
			computedStats: {
				physicalDamage: { min: 12, max: 25 },
				elementalDamage: [{ element: "Fire", min: 6, max: 12 }],
				attackSpeed: 1.0,
				criticalChance: 6,
			},
		};
		const stats = computeCharacterStats({
			classDef: mage,
			level: 1,
			equippedItems: [{ slot: "weapon", item: wandItem }],
			selectedElement: "lightning",
		});
		const swing = stats.swings[0];
		expect(swing.physicalDamage).toEqual({ min: 0, max: 0 });
		const fire = swing.elementalDamage.find((e) => e.element === "Fire");
		const lightning = swing.elementalDamage.find((e) => e.element === "Lightning");
		expect(fire).toEqual({ element: "Fire", min: 6, max: 12 });
		expect(lightning).toEqual({ element: "Lightning", min: 13, max: 27 });
	});

	it("wand+wand dual-wields without receiving the attack-DW buffs", () => {
		const eq: EquippedItem[] = [
			{ slot: "weapon", item: wand("w1", { min: 4, max: 8 }) },
			{ slot: "offhand", item: wand("w2", { min: 4, max: 8 }) },
		];
		const stats = computeCharacterStats({
			classDef: mage,
			level: 1,
			equippedItems: eq,
		});
		expect(stats.swings).toHaveLength(2);
		expect(isAttackDualWielding(stats)).toBe(false);
		expect(stats.blockChance).toBe(0);
		// avg(1.0, 1.0) with no DW more multiplier
		expect(stats.tickRate).toBeCloseTo(1.0);
	});

	it("flat physical from gear adds onto attack swing damage", () => {
		const eq: EquippedItem[] = [
			{
				slot: "weapon",
				item: sword("s1", { min: 10, max: 20, speed: 1.5, crit: 5 }),
			},
			{
				slot: "amulet",
				item: helmet("a1", [mod("physicalDamageFlatGlobal", 7)]),
			},
		];
		const stats = computeCharacterStats({
			classDef: warrior,
			level: 1,
			equippedItems: eq,
		});
		expect(stats.swings[0].physicalDamage.min).toBe(17);
		expect(stats.swings[0].physicalDamage.max).toBe(27);
	});

	it("globalAttackSpeedIncrease scales the combined tick rate", () => {
		const eq: EquippedItem[] = [
			{
				slot: "weapon",
				item: sword("s1", { min: 5, max: 10, speed: 1.0, crit: 5 }),
			},
			{
				slot: "gloves",
				item: helmet("g1", [mod("globalAttackSpeedIncrease", 20)]),
			},
		];
		const stats = computeCharacterStats({
			classDef: warrior,
			level: 1,
			equippedItems: eq,
		});
		expect(stats.tickRate).toBeCloseTo(1.0 * 1.2);
	});

	it("globalArmorIncrease applies after summing flat armor", () => {
		const eq: EquippedItem[] = [
			{ slot: "helmet", item: helmet("h1", [mod("armorFlat", 100)]) },
			{
				slot: "chestplate",
				item: helmet("c1", [mod("globalArmorIncrease", 50)]),
			},
		];
		const stats = computeCharacterStats({
			classDef: warrior,
			level: 1,
			equippedItems: eq,
		});
		expect(stats.armor).toBe(150);
	});
});

describe("computeCharacterStats — broken state", () => {
	it("an item whose requirements are unmet enters broken state and contributes 0", () => {
		const eq: EquippedItem[] = [
			{
				slot: "helmet",
				item: helmet("h1", [mod("strengthFlat", 20)], { level: 1, str: 50 }),
			},
		];
		const stats = computeCharacterStats({
			classDef: warrior,
			level: 1,
			equippedItems: eq,
		});
		expect(stats.brokenItemIds.has("h1")).toBe(true);
		expect(stats.attributes.strength).toBe(10); // class base only — helmet broken
	});

	it("self-sustaining helmet: gives +15 STR, requires STR 15, stays functional when STR floor met by self", () => {
		// Warrior has STR 10. Add a ring giving +5 STR (puts total at 15). Then the
		// helmet requires STR 15 and gives +15. With ring contributing, totals are
		// 30 — helmet's requirement met. The broken-state check passes including
		// the helmet's own contribution.
		const eq: EquippedItem[] = [
			{
				slot: "ring1",
				item: helmet("r1", [mod("strengthFlat", 5)]),
			},
			{
				slot: "helmet",
				item: helmet("h1", [mod("strengthFlat", 15)], { level: 1, str: 15 }),
			},
		];
		const stats = computeCharacterStats({
			classDef: warrior,
			level: 1,
			equippedItems: eq,
		});
		expect(stats.brokenItemIds.size).toBe(0);
		expect(stats.attributes.strength).toBe(10 + 5 + 15);
	});

	it("broken cascade: removing the STR ring breaks the helmet that depended on it", () => {
		// Same setup as above but ring removed → helmet alone would need STR 15
		// from a base of STR 10 + self 15 = 25 → ok actually it passes.
		// Construct a case where the helmet cannot self-sustain: helmet gives +5
		// STR, requires STR 15. Class STR 10 + self 5 = 15 → just passes.
		// Now require STR 16: 10 + 5 = 15 < 16 → broken.
		const eq: EquippedItem[] = [
			{
				slot: "helmet",
				item: helmet("h1", [mod("strengthFlat", 5)], { level: 1, str: 16 }),
			},
		];
		const stats = computeCharacterStats({
			classDef: warrior,
			level: 1,
			equippedItems: eq,
		});
		expect(stats.brokenItemIds.has("h1")).toBe(true);
		expect(stats.attributes.strength).toBe(10);
	});

	it("quiver in off-hand without a bow main hand enters broken state", () => {
		const eq: EquippedItem[] = [
			{
				slot: "weapon",
				item: sword("sw", { min: 5, max: 7, speed: 1.0, crit: 5 }),
			},
			{ slot: "offhand", item: quiver("q", [mod("dexterityFlat", 20)]) },
		];
		const stats = computeCharacterStats({
			classDef: warrior,
			level: 1,
			equippedItems: eq,
		});
		expect(stats.brokenItemIds.has("q")).toBe(true);
		// The dex mod must not have applied — class baseline only.
		expect(stats.attributes.dexterity).toBe(
			warrior.baseStats.attributes.dexterity,
		);
	});

	it("quiver in off-hand WITH a bow main hand is not broken", () => {
		const eq: EquippedItem[] = [
			{ slot: "weapon", item: bow("bw") },
			{ slot: "offhand", item: quiver("q2", [mod("dexterityFlat", 20)]) },
		];
		const stats = computeCharacterStats({
			classDef: warrior,
			level: 1,
			equippedItems: eq,
		});
		expect(stats.brokenItemIds.has("q2")).toBe(false);
		expect(stats.attributes.dexterity).toBe(
			warrior.baseStats.attributes.dexterity + 20,
		);
	});

	it("quiver's global flat-to-attacks mods contribute to the bow's swing damage", () => {
		// Regression: prior to the off-hand filter fix, equipping a quiver with
		// flat-to-attacks globals silently dropped those mods from the gear pool
		// (the call site filtered out all off-hand items). This test pins the
		// fix: cold damage from a quiver shows up in the resulting swing.
		const eq: EquippedItem[] = [
			{ slot: "weapon", item: bow("bw") },
			{
				slot: "offhand",
				item: quiver("q", [mod("coldDamageToAttacksFlatGlobal", 8)]),
			},
		];
		const stats = computeCharacterStats({
			classDef: warrior,
			level: 1,
			equippedItems: eq,
		});
		expect(stats.brokenItemIds.has("q")).toBe(false);
		expect(stats.swings).toHaveLength(1);
		const cold = stats.swings[0].elementalDamage.find(
			(e) => e.element === "Cold",
		);
		expect(cold?.min).toBe(8);
		expect(cold?.max).toBe(8);
	});
});

describe("derived helpers", () => {
	it("armor mitigation follows armor / (armor + 10×referenceHit), capped 85%", () => {
		// Same numerics as before — the arg semantically renamed from
		// "enemy level" to "reference hit size" so the panel preview
		// matches the gameplay PoE-style formula.
		expect(computeArmorMitigation(100, 10).reductionPct).toBeCloseTo(50);
		expect(computeArmorMitigation(100, 50).reductionPct).toBeCloseTo(16.67, 1);
		expect(computeArmorMitigation(10000, 10).reductionPct).toBe(85);
		expect(computeArmorMitigation(0, 10).reductionPct).toBe(0);
	});

	it("evasion avoid uses hitChance = acc / (acc + evasion/4), clamped", () => {
		// Equal accuracy and evasion/4 → 50% hit, 50% avoid
		expect(computeEvasionAvoid(400, 100).avoidPct).toBeCloseTo(50);
		// No evasion → 5% avoid (capped at 95% hit)
		expect(computeEvasionAvoid(0, 100).avoidPct).toBeCloseTo(5);
		// Massive evasion → 95% avoid (capped)
		expect(computeEvasionAvoid(100000, 100).avoidPct).toBeCloseTo(95);
	});

	it("crit chance respects [5%, 100%]", () => {
		expect(effectiveCritChance(0, 0)).toBe(5);
		expect(effectiveCritChance(50, 200)).toBe(100);
		expect(effectiveCritChance(10, 50)).toBe(15);
	});
});

describe("attribute bonuses", () => {
	// Warrior baseline: Str=10, Dex=5, Int=5.
	const warriorClass = CLASS_DEFINITIONS.warrior;

	it("Str adds 1% melee damage per point", () => {
		const stats = computeCharacterStats({
			classDef: warriorClass,
			level: 1,
			equippedItems: [],
		});
		// 10 Str → +10% melee, no other increased.melee source at L1 unarmed.
		expect(stats.increased.melee).toBe(10);
	});

	it("Str adds 5 life per point (flat) on top of class base + level", () => {
		const stats = computeCharacterStats({
			classDef: warriorClass,
			level: 1,
			equippedItems: [],
		});
		// 70 (warrior base) + 0 (L1 → no level bonus yet) + 10 Str * 5 = 120.
		expect(stats.maxLife).toBe(120);
	});

	it("Dex adds 2 accuracy per point", () => {
		const stats = computeCharacterStats({
			classDef: warriorClass,
			level: 1,
			equippedItems: [],
		});
		// 5 Dex → +10 accuracy on top of the class baseline.
		expect(stats.accuracy).toBeGreaterThanOrEqual(10);
	});

	it("Dex adds 1% evasion increased per point via the global fold", () => {
		// Equip a leather helmet so there is a flat evasion source to multiply.
		// Warrior has 5 Dex baseline → +5% evasion increased.
		const eq: EquippedItem[] = [
			{
				slot: "helmet",
				item: {
					...helmet("h1", []),
					computedDefenseStats: { evasion: 100 },
				},
			},
		];
		const stats = computeCharacterStats({
			classDef: warriorClass,
			level: 1,
			equippedItems: eq,
		});
		// 100 flat evasion * (1 + 5%) = 105 rounded.
		expect(stats.evasion).toBe(105);
	});

	it("Dex evasion% does nothing without a flat evasion source (no double-dipping)", () => {
		// Warrior with no leather and no flat evasion mods — Dex × 1% × 0 = 0.
		const stats = computeCharacterStats({
			classDef: warriorClass,
			level: 1,
			equippedItems: [],
		});
		expect(stats.evasion).toBe(0);
	});

	it("Int adds 1% barrier per point via the global fold", () => {
		const mageClass = CLASS_DEFINITIONS.mage;
		const base = computeCharacterStats({
			classDef: {
				...mageClass,
				baseStats: { ...mageClass.baseStats, barrier: 100 },
			},
			level: 1,
			equippedItems: [],
		});
		// 10 Int → +10% barrier → 100 × 1.10 = 110.
		expect(base.maxBarrier).toBe(110);
	});
});
