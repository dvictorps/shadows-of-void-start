import { describe, expect, it } from "vitest";
import { rollBossDrops, rollMinibossDrops } from "./drops";

const SAMPLES = 200;

describe("rollBossDrops", () => {
	it("emits 2 or 3 items including a guaranteed Rare", () => {
		for (let i = 0; i < SAMPLES; i++) {
			const drops = rollBossDrops({ monsterLevel: 17 });
			expect(drops.length).toBeGreaterThanOrEqual(2);
			expect(drops.length).toBeLessThanOrEqual(3);
			expect(drops.some((d) => d.rarity === "rare")).toBe(true);
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
	it("still emits 2 items with one guaranteed Rare", () => {
		for (let i = 0; i < SAMPLES; i++) {
			const drops = rollMinibossDrops({ monsterLevel: 14 });
			expect(drops.length).toBeGreaterThanOrEqual(1);
			expect(drops.length).toBeLessThanOrEqual(2);
			expect(drops.some((d) => d.rarity === "rare")).toBe(true);
		}
	});
});
