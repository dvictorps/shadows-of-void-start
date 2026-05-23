import { describe, expect, it } from "vitest";
import {
	applyDeathXpPenalty,
	applyOverlevelPenalty,
	applyXpGain,
	XP_CURVE_BASE,
	XP_CURVE_GROWTH,
	xpToNextLevel,
} from "./levels";

describe("xpToNextLevel", () => {
	it("anchors L1→L2 at the base", () => {
		expect(xpToNextLevel(1)).toBe(XP_CURVE_BASE);
	});

	it("multiplies by the growth rate each level", () => {
		expect(xpToNextLevel(2)).toBe(Math.floor(XP_CURVE_BASE * XP_CURVE_GROWTH));
		expect(xpToNextLevel(10)).toBe(
			Math.floor(XP_CURVE_BASE * XP_CURVE_GROWTH ** 9),
		);
	});

	it("hits documented landmarks", () => {
		// Sanity-check the user-facing pacing claims in CONTEXT.md. If these
		// shift, the doc needs to shift too.
		expect(xpToNextLevel(50)).toBe(4342);
		expect(xpToNextLevel(100)).toBe(203681);
	});

	it("clamps levels below 1 to L1", () => {
		expect(xpToNextLevel(0)).toBe(XP_CURVE_BASE);
		expect(xpToNextLevel(-5)).toBe(XP_CURVE_BASE);
	});
});

describe("applyXpGain", () => {
	it("adds XP without levelling when below threshold", () => {
		const r = applyXpGain(5, 30, 50);
		expect(r.level).toBe(5);
		expect(r.xp).toBe(80);
		expect(r.levelsGained).toBe(0);
	});

	it("levels once when threshold is exactly met", () => {
		const cost = xpToNextLevel(3);
		const r = applyXpGain(3, 0, cost);
		expect(r.level).toBe(4);
		expect(r.xp).toBe(0);
		expect(r.levelsGained).toBe(1);
	});

	it("carries overflow into the next level", () => {
		const cost1 = xpToNextLevel(2);
		const r = applyXpGain(2, 0, cost1 + 10);
		expect(r.level).toBe(3);
		expect(r.xp).toBe(10);
		expect(r.levelsGained).toBe(1);
	});

	it("cascades multiple level-ups when a big gain crosses several thresholds", () => {
		const sum = xpToNextLevel(1) + xpToNextLevel(2) + xpToNextLevel(3);
		const r = applyXpGain(1, 0, sum);
		expect(r.level).toBe(4);
		expect(r.xp).toBe(0);
		expect(r.levelsGained).toBe(3);
	});

	it("stops at the level cap and zeroes XP", () => {
		const r = applyXpGain(99, 0, 1_000_000_000, 100);
		expect(r.level).toBe(100);
		expect(r.xp).toBe(0);
	});
});

describe("applyDeathXpPenalty", () => {
	it("removes 5% of current XP, floored", () => {
		const r = applyDeathXpPenalty(1000);
		expect(r.xp).toBe(950);
		expect(r.xpLost).toBe(50);
	});

	it("never goes negative", () => {
		const r = applyDeathXpPenalty(3);
		// floor(3 × 0.05) = 0, so no loss on tiny XP balances
		expect(r.xp).toBe(3);
		expect(r.xpLost).toBe(0);
	});
});

describe("applyOverlevelPenalty", () => {
	it("is a no-op within the 2-level grace window", () => {
		expect(applyOverlevelPenalty(100, 5, 5)).toBe(100); // same level
		expect(applyOverlevelPenalty(100, 6, 5)).toBe(100); // +1
		expect(applyOverlevelPenalty(100, 7, 5)).toBe(100); // +2
	});

	it("kicks in quadratically from +3 levels over", () => {
		// delta = 1 → (1 - 0.1)^2 = 0.81
		expect(applyOverlevelPenalty(100, 8, 5)).toBe(81);
		// delta = 3 → (1 - 0.3)^2 = 0.49
		expect(applyOverlevelPenalty(100, 10, 5)).toBe(49);
		// delta = 5 → (1 - 0.5)^2 = 0.25
		expect(applyOverlevelPenalty(100, 12, 5)).toBe(25);
	});

	it("floors at 5% so kills always grant some XP", () => {
		// delta = 12 → (1 - 1.2)^2 = 0.04 → clamped to 0.05
		expect(applyOverlevelPenalty(100, 19, 5)).toBe(5);
		// Extreme over-leveling still floors
		expect(applyOverlevelPenalty(100, 99, 5)).toBe(5);
	});

	it("never returns less than 1 from a positive reward", () => {
		expect(applyOverlevelPenalty(2, 99, 5)).toBe(1);
	});

	it("does not boost XP when under-leveled (penalty is one-directional)", () => {
		expect(applyOverlevelPenalty(100, 1, 50)).toBe(100);
	});
});
