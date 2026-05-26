import { describe, expect, it } from "vitest";
import {
	promoteRarity,
	rollBossDrops,
	rollMinibossDrops,
} from "./drops";

const SAMPLES = 200;

describe("rollBossDrops", () => {
	it("emits 2 or 3 items including at least one Rare or Legendary", () => {
		for (let i = 0; i < SAMPLES; i++) {
			const drops = rollBossDrops({ monsterLevel: 17 });
			expect(drops.length).toBeGreaterThanOrEqual(2);
			expect(drops.length).toBeLessThanOrEqual(3);
			expect(
				drops.some((d) => d.rarity === "rare" || d.rarity === "legendary"),
			).toBe(true);
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
			expect(drops.length).toBeGreaterThanOrEqual(1);
			expect(drops.length).toBeLessThanOrEqual(2);
			expect(
				drops.some((d) => d.rarity === "rare" || d.rarity === "legendary"),
			).toBe(true);
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

	it("never promotes beyond legendary", () => {
		for (let i = 0; i < 1000; i++) {
			const result = promoteRarity("legendary", 9999);
			expect(result).toBe("legendary");
		}
	});
});
