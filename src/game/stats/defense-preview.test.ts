import { describe, expect, it } from "vitest";

import { computeArmorMitigation, computeEvasionAvoid } from "./compute";
import { defensePreview } from "./defense-preview";

describe("defensePreview", () => {
	it("measures armor against a 5-per-level hit and evasion against 10-per-level accuracy", () => {
		const p = defensePreview(120, 300, 7);
		expect(p.armorReductionPct).toBe(
			computeArmorMitigation(120, 35).reductionPct,
		);
		expect(p.evasionAvoidPct).toBe(computeEvasionAvoid(300, 70).avoidPct);
	});

	it("never measures armor against a hit below 5", () => {
		expect(defensePreview(50, 0, 0).armorReductionPct).toBe(
			computeArmorMitigation(50, 5).reductionPct,
		);
	});

	it("grows weaker as the enemy level rises", () => {
		const low = defensePreview(200, 200, 2);
		const high = defensePreview(200, 200, 20);
		expect(high.armorReductionPct).toBeLessThan(low.armorReductionPct);
		expect(high.evasionAvoidPct).toBeLessThan(low.evasionAvoidPct);
	});
});
