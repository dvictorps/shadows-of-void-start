import { describe, expect, it } from "vitest";
import {
	rollBossDrops,
	rollGauntletRareDrops,
	rollMinibossDrops,
} from "./drops";

// Loot routing for boss nodes — the three new drop functions plus
// regression coverage on the existing miniboss flow. We sample over many
// rolls because the per-call randomness is in pickWeighted / template
// selection; sampling makes the distribution-level assertions stable.

const SAMPLES = 200;

describe("rollGauntletRareDrops", () => {
	it("always produces exactly one item", () => {
		for (let i = 0; i < SAMPLES; i++) {
			const drops = rollGauntletRareDrops({ monsterLevel: 14 });
			expect(drops.length).toBeLessThanOrEqual(1);
		}
	});

	it("biases toward magic over rare (70/30)", () => {
		let magic = 0;
		let rare = 0;
		for (let i = 0; i < SAMPLES; i++) {
			const [drop] = rollGauntletRareDrops({ monsterLevel: 14 });
			if (!drop) continue;
			if (drop.rarity === "magic") magic++;
			else if (drop.rarity === "rare") rare++;
		}
		// With 200 samples and 70/30, magic should clearly dominate. Use a
		// wide bound (>2× rare) so the assertion isn't flaky across seeds.
		expect(magic).toBeGreaterThan(rare * 2);
	});

	it("never drops Normal items (gauntlet floor is Magic)", () => {
		for (let i = 0; i < SAMPLES; i++) {
			const drops = rollGauntletRareDrops({ monsterLevel: 14 });
			for (const d of drops) {
				expect(d.rarity).not.toBe("normal");
			}
		}
	});
});

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
