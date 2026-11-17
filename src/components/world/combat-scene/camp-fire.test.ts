import { describe, expect, it } from "vitest";

import { rngFromUnit, seededRng } from "#/lib/rng";

import { nextFireFrame, nextGlow } from "./camp-fire";

describe("nextFireFrame", () => {
	it("never repeats the current frame", () => {
		const rng = seededRng(7);
		let frame = 0;
		for (let i = 0; i < 500; i++) {
			const next = nextFireFrame(frame, 3, rng);
			expect(next).not.toBe(frame);
			expect(next).toBeGreaterThanOrEqual(0);
			expect(next).toBeLessThan(3);
			frame = next;
		}
	});

	it("reaches every other frame", () => {
		expect(
			nextFireFrame(
				0,
				3,
				rngFromUnit(() => 0),
			),
		).toBe(1);
		expect(
			nextFireFrame(
				0,
				3,
				rngFromUnit(() => 0.99),
			),
		).toBe(2);
		expect(
			nextFireFrame(
				2,
				3,
				rngFromUnit(() => 0),
			),
		).toBe(0);
	});

	it("holds a single frame", () => {
		expect(
			nextFireFrame(
				0,
				1,
				rngFromUnit(() => 0.5),
			),
		).toBe(0);
	});
});

describe("nextGlow", () => {
	it("stays between 0.8 and 1", () => {
		expect(nextGlow(rngFromUnit(() => 0))).toBe(0.8);
		expect(nextGlow(rngFromUnit(() => 0.999))).toBeLessThanOrEqual(1);
	});
});
