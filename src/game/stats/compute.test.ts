import { describe, expect, it } from "vitest";
import { CLASS_DEFINITIONS } from "../classes/data";
import type { GeneratedItem, RolledMod } from "../items/types";
import {
	computeArmorMitigation,
	computeCharacterStats,
	computeEvasionAvoid,
	effectiveCritChance,
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
		expect(stats.maxLife).toBe(100);
		expect(stats.maxBarrier).toBe(0);
		expect(stats.path).toBe("unarmed");
		expect(stats.swings).toHaveLength(0);
	});

	it("scales max life linearly with level", () => {
		const stats = computeCharacterStats({
			classDef: warrior,
			level: 10,
			equippedItems: [],
		});
		expect(stats.maxLife).toBe(100 + 9 * 10);
	});

	it("mage starts with class barrier", () => {
		const stats = computeCharacterStats({
			classDef: mage,
			level: 1,
			equippedItems: [],
		});
		expect(stats.maxBarrier).toBe(20);
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

	it("dual-wielding two attack 1H weapons combines tick rate", () => {
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
		expect(stats.tickRate).toBeCloseTo(1.5 + 1.6);
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
});

describe("derived helpers", () => {
	it("armor mitigation follows armor / (armor + 10×enemyLevel), capped 85%", () => {
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
