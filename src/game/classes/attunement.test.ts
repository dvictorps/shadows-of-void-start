import { describe, expect, it } from "vitest";

import { LEVEL_CAP } from "../progression/levels";
import { attunementLevelBonus } from "./attunement";

describe("attunementLevelBonus", () => {
	it("starts at +3 / +5 at level 1", () => {
		expect(attunementLevelBonus(1)).toEqual({ min: 3, max: 5 });
	});

	it("reaches the same +100 / +200 as before at the level cap", () => {
		expect(LEVEL_CAP).toBe(100);
		expect(attunementLevelBonus(LEVEL_CAP)).toEqual({ min: 100, max: 200 });
	});

	it("interpolates linearly between the anchors", () => {
		expect(attunementLevelBonus(30)).toEqual({ min: 31, max: 62 });
		expect(attunementLevelBonus(50)).toEqual({ min: 51, max: 102 });
	});

	it("never decreases from one level to the next", () => {
		for (let level = 2; level <= LEVEL_CAP; level++) {
			const prev = attunementLevelBonus(level - 1);
			const cur = attunementLevelBonus(level);
			expect(cur.min).toBeGreaterThanOrEqual(prev.min);
			expect(cur.max).toBeGreaterThanOrEqual(prev.max);
		}
	});

	it("clamps levels outside 1..cap", () => {
		expect(attunementLevelBonus(0)).toEqual(attunementLevelBonus(1));
		expect(attunementLevelBonus(LEVEL_CAP + 5)).toEqual(
			attunementLevelBonus(LEVEL_CAP),
		);
	});
});
