import { describe, expect, it } from "vitest";

import {
	MONSTER_SCALING_BASE,
	monsterScaleFactor,
	scaleMonsterStats,
} from "./scaling";
import type { MonsterDefinition } from "./types";

const baseDef: MonsterDefinition = {
	id: "test",
	name: "Test",
	sprite: "/tmp/test.png",
	baseStats: {
		hp: 10,
		attackSpeed: 1.2,
		physicalDamage: { min: 8, max: 12 },
		elementalDamage: [],
	},
	xpReward: 5,
	allowedRarities: ["normal"],
};

describe("monsterScaleFactor", () => {
	it("returns 1 at level 1", () => {
		expect(monsterScaleFactor(1)).toBe(1);
	});

	it("returns the base at level 2", () => {
		expect(monsterScaleFactor(2)).toBeCloseTo(MONSTER_SCALING_BASE);
	});

	it("clamps levels below 1 to level 1", () => {
		expect(monsterScaleFactor(0)).toBe(1);
		expect(monsterScaleFactor(-5)).toBe(1);
	});

	it("matches PoE-style growth at landmark levels", () => {
		expect(monsterScaleFactor(50)).toBeCloseTo(17.378, 2);
		expect(monsterScaleFactor(100)).toBeCloseTo(320.0, 0);
	});
});

describe("scaleMonsterStats", () => {
	it("returns the baseline unchanged at level 1", () => {
		const stats = scaleMonsterStats(baseDef, 1);
		expect(stats.hp).toBe(10);
		expect(stats.physicalDamage).toEqual({ min: 8, max: 12 });
		expect(stats.xpReward).toBe(5);
		expect(stats.elementalDamage).toEqual([]);
	});

	it("preserves attack speed regardless of level", () => {
		expect(scaleMonsterStats(baseDef, 1).attackSpeed).toBe(1.2);
		expect(scaleMonsterStats(baseDef, 50).attackSpeed).toBe(1.2);
		expect(scaleMonsterStats(baseDef, 100).attackSpeed).toBe(1.2);
	});

	it("scales hp, damage and xp geometrically", () => {
		const stats = scaleMonsterStats(baseDef, 100);
		expect(stats.hp).toBe(3201);
		expect(stats.physicalDamage.min).toBe(2561);
		expect(stats.physicalDamage.max).toBe(3841);
		expect(stats.xpReward).toBe(1600);
	});

	it("floors hp and xp to at least 1", () => {
		const tinyDef: MonsterDefinition = {
			...baseDef,
			baseStats: { ...baseDef.baseStats, hp: 0 },
			xpReward: 0,
		};
		const stats = scaleMonsterStats(tinyDef, 50);
		expect(stats.hp).toBe(1);
		expect(stats.xpReward).toBe(1);
	});

	it("scales each elemental damage entry independently", () => {
		const lichDef: MonsterDefinition = {
			...baseDef,
			baseStats: {
				...baseDef.baseStats,
				physicalDamage: { min: 0, max: 0 },
				elementalDamage: [{ element: "Cold", min: 12, max: 16 }],
			},
		};
		const stats = scaleMonsterStats(lichDef, 50);
		expect(stats.elementalDamage).toEqual([
			{ element: "Cold", min: 209, max: 278 },
		]);
	});

	it("keeps min ≤ max after rounding", () => {
		const stats = scaleMonsterStats(baseDef, 73);
		expect(stats.physicalDamage.min).toBeLessThanOrEqual(
			stats.physicalDamage.max,
		);
	});

	it("populates defensive defaults: zero armor/evasion/resists, accuracy = level × 15", () => {
		const stats = scaleMonsterStats(baseDef, 7);
		expect(stats.level).toBe(7);
		expect(stats.armor).toBe(0);
		expect(stats.evasion).toBe(0);
		expect(stats.accuracy).toBe(105);
		expect(stats.resistances).toEqual({
			cold: 0,
			fire: 0,
			lightning: 0,
			void: 0,
		});
	});
});
