import { describe, expect, it } from "vitest";

import type { ItemRarity } from "#/game/items/types";
import { type Rng, rngFromUnit, seededRng } from "#/lib/rng";

import {
	promoteRarity,
	rollBossDrops,
	rollDrop,
	rollMinibossDrops,
	rollMonsterLevel,
} from "./drops";

const SAMPLES = 200;

const RARE_OR_HIGHER: ReadonlySet<ItemRarity> = new Set([
	"rare",
	"legendary",
	"epic",
]);

describe("rollBossDrops", () => {
	it("emits 2 or 3 items including at least one Rare or higher", () => {
		for (let i = 0; i < SAMPLES; i++) {
			const drops = rollBossDrops({ monsterLevel: 17 });
			expect(drops.length).toBeGreaterThanOrEqual(2);
			expect(drops.length).toBeLessThanOrEqual(3);
			expect(drops.some((d) => RARE_OR_HIGHER.has(d.rarity))).toBe(true);
		}
	});

	it("never drops Normal items (boss floor is Magic per CONTEXT.md)", () => {
		for (let i = 0; i < SAMPLES; i++) {
			const drops = rollBossDrops({ monsterLevel: 17 });
			for (const d of drops) {
				expect(d.rarity).not.toBe("normal");
			}
		}
	});
});

describe("rollMinibossDrops regression", () => {
	it("still emits 2 items with one guaranteed Rare or higher", () => {
		for (let i = 0; i < SAMPLES; i++) {
			const drops = rollMinibossDrops({ monsterLevel: 14 });
			expect(drops).toHaveLength(2);
			expect(drops.some((d) => RARE_OR_HIGHER.has(d.rarity))).toBe(true);
		}
	});
});

describe("promoteRarity", () => {
	it("returns the same rarity when magicFind is 0 and roll fails", () => {
		let sameCount = 0;
		for (let i = 0; i < 1000; i++) {
			if (promoteRarity("rare", 0) === "rare") sameCount++;
		}
		expect(sameCount).toBeGreaterThan(950);
	});

	it("promotes more often with higher magicFind", () => {
		let promoLow = 0;
		let promoHigh = 0;
		const runs = 5000;
		for (let i = 0; i < runs; i++) {
			if (promoteRarity("normal", 0) !== "normal") promoLow++;
			if (promoteRarity("normal", 500) !== "normal") promoHigh++;
		}
		expect(promoHigh).toBeGreaterThan(promoLow);
	});

	it("never promotes beyond epic", () => {
		for (let i = 0; i < 1000; i++) {
			const result = promoteRarity("epic", 9999);
			expect(result).toBe("epic");
		}
	});

	it("legendary can promote to epic with high MF", () => {
		let sawEpic = false;
		for (let i = 0; i < 10000; i++) {
			if (promoteRarity("legendary", 9999) === "epic") {
				sawEpic = true;
				break;
			}
		}
		expect(sawEpic).toBe(true);
	});
});

describe("drops — injected rng", () => {
	it("repeats a kill's drops for the same seed", () => {
		const drops = (seed: number) => {
			const rng = seededRng(seed);
			return [
				rollDrop(
					{ monsterRarity: "rare", monsterLevel: 30, magicFind: 50 },
					rng,
				),
				rollMinibossDrops({ monsterLevel: 30 }, rng),
				rollBossDrops({ monsterLevel: 30 }, rng),
				rollMonsterLevel(30, rng),
			];
		};
		expect(drops(77)).toEqual(drops(77));
	});
});

const NO_PROMOTION = 0.999;

function scripted(rolls: number[]): Rng {
	const rest = seededRng(1);
	let next = 0;
	return rngFromUnit(() =>
		next < rolls.length ? (rolls[next++] ?? 0) : rest.unit(),
	);
}

describe("rollDrop — CONTEXT.md drop rates", () => {
	it.each([
		["normal", 0.299, true],
		["normal", 0.301, false],
		["magic", 0.599, true],
		["magic", 0.601, false],
	] as const)(
		"a %s mob drops on a roll of %s: %s",
		(monsterRarity, roll, drops) => {
			const item = rollDrop(
				{ monsterRarity, monsterLevel: 5 },
				scripted([roll, 0, NO_PROMOTION]),
			);
			expect(item !== null).toBe(drops);
		},
	);

	it.each([
		["normal", 0.699, "normal"],
		["normal", 0.701, "magic"],
		["normal", 0.949, "magic"],
		["normal", 0.951, "rare"],
		["magic", 0.399, "normal"],
		["magic", 0.401, "magic"],
		["magic", 0.899, "magic"],
		["magic", 0.901, "rare"],
	] as const)(
		"a %s mob's rarity roll of %s gives %s",
		(monsterRarity, roll, rarity) => {
			const item = rollDrop(
				{ monsterRarity, monsterLevel: 5 },
				scripted([0, roll, NO_PROMOTION]),
			);
			expect(item?.rarity).toBe(rarity);
		},
	);
});

describe("promoteRarity — CONTEXT.md magic find", () => {
	it.each([
		["normal", 0, 0.1, "magic"],
		["normal", 100, 0.2, "magic"],
		["normal", 200, 0.3, "magic"],
		["magic", 0, 0.05, "rare"],
		["magic", 100, 0.1, "rare"],
		["magic", 200, 0.15, "rare"],
		["rare", 0, 0.01, "legendary"],
		["rare", 100, 0.02, "legendary"],
		["rare", 200, 0.03, "legendary"],
		["legendary", 0, 0.01, "epic"],
	] as const)(
		"%s at %s%% MF promotes below %s to %s",
		(from, magicFind, threshold, to) => {
			expect(
				promoteRarity(
					from,
					magicFind,
					scripted([threshold * 0.99, NO_PROMOTION]),
				),
			).toBe(to);
			expect(promoteRarity(from, magicFind, scripted([threshold * 1.01]))).toBe(
				from,
			);
		},
	);

	it("chains one independent roll per tier up to epic", () => {
		expect(promoteRarity("normal", 0, scripted([0, 0, 0, 0]))).toBe("epic");
		expect(promoteRarity("normal", 0, scripted([0, 0, NO_PROMOTION]))).toBe(
			"rare",
		);
	});
});
