import { describe, expect, it } from "vitest";
import {
	applyMonsterMods,
	MONSTER_MODIFIERS,
	type MonsterModId,
	modCountForRarity,
	rollMonsterMods,
	rollMonsterRarity,
} from "./modifiers";
import { scaleMonsterStats } from "./scaling";
import type { MonsterDefinition } from "./types";

const baseDef: MonsterDefinition = {
	id: "test",
	name: "Test",
	sprite: "/tmp/test.png",
	baseStats: {
		hp: 100,
		attackSpeed: 1.0,
		physicalDamage: { min: 10, max: 10 },
		elementalDamage: [],
	},
	xpReward: 5,
	allowedRarities: ["normal", "magic"],
};

describe("rollMonsterRarity", () => {
	it("returns magic when random < 0.1", () => {
		expect(rollMonsterRarity(() => 0)).toBe("magic");
		expect(rollMonsterRarity(() => 0.09)).toBe("magic");
	});

	it("returns normal otherwise", () => {
		expect(rollMonsterRarity(() => 0.1)).toBe("normal");
		expect(rollMonsterRarity(() => 0.5)).toBe("normal");
		expect(rollMonsterRarity(() => 0.99)).toBe("normal");
	});
});

describe("modCountForRarity", () => {
	it("matches CONTEXT.md: normal=0, magic=1, rare=3", () => {
		expect(modCountForRarity("normal")).toBe(0);
		expect(modCountForRarity("magic")).toBe(1);
		expect(modCountForRarity("rare")).toBe(3);
	});
});

describe("rollMonsterMods", () => {
	it("picks N distinct mods (no duplicates)", () => {
		const picked = rollMonsterMods(3);
		expect(picked).toHaveLength(3);
		expect(new Set(picked).size).toBe(3);
	});

	it("returns empty for non-positive count", () => {
		expect(rollMonsterMods(0)).toEqual([]);
		expect(rollMonsterMods(-1)).toEqual([]);
	});

	it("caps at pool size when count exceeds available mods", () => {
		const poolSize = Object.keys(MONSTER_MODIFIERS).length;
		const picked = rollMonsterMods(poolSize + 5);
		expect(picked).toHaveLength(poolSize);
	});
});

describe("applyMonsterMods", () => {
	it("returns input unchanged when no mods", () => {
		const scaled = scaleMonsterStats(baseDef, 1);
		expect(applyMonsterMods(scaled, [])).toEqual(scaled);
	});

	it("Increased Life multiplies HP by 1.5", () => {
		const scaled = scaleMonsterStats(baseDef, 1);
		const after = applyMonsterMods(scaled, ["monsterIncreasedLife"]);
		expect(after.hp).toBe(150);
	});

	it("Increased Damage multiplies physical + elemental damage by 1.4", () => {
		const lichDef: MonsterDefinition = {
			...baseDef,
			baseStats: {
				...baseDef.baseStats,
				physicalDamage: { min: 0, max: 0 },
				elementalDamage: [{ element: "Cold", min: 100, max: 100 }],
			},
		};
		const scaled = scaleMonsterStats(lichDef, 1);
		const after = applyMonsterMods(scaled, ["monsterIncreasedDamage"]);
		expect(after.elementalDamage[0]).toEqual({
			element: "Cold",
			min: 140,
			max: 140,
		});
	});

	it("Additional Barrier (placeholder) folds into HP × 1.3", () => {
		const scaled = scaleMonsterStats(baseDef, 1);
		const after = applyMonsterMods(scaled, ["monsterAdditionalBarrier"]);
		expect(after.hp).toBe(130);
	});

	it("resistance mods add 50% to the matching element", () => {
		const scaled = scaleMonsterStats(baseDef, 1);
		const after = applyMonsterMods(scaled, [
			"monsterColdResistance",
			"monsterFireResistance",
		]);
		expect(after.resistances).toEqual({
			cold: 50,
			fire: 50,
			lightning: 0,
			void: 0,
		});
	});

	it("Accuracy mod adds 500 to baseline (level × 10)", () => {
		const scaled = scaleMonsterStats(baseDef, 10);
		// Baseline accuracy = level 10 × 10 = 100, +500 → 600
		const after = applyMonsterMods(scaled, ["monsterIncreasedAccuracy"]);
		expect(after.accuracy).toBe(600);
	});

	it("composes multiple mods in order (deterministic)", () => {
		const scaled = scaleMonsterStats(baseDef, 1);
		const mods: MonsterModId[] = [
			"monsterIncreasedLife",
			"monsterAdditionalBarrier",
		];
		const after = applyMonsterMods(scaled, mods);
		// HP 100 × 1.5 = 150 → × 1.3 = 195
		expect(after.hp).toBe(195);
	});
});
