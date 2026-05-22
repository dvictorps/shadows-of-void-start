import { describe, expect, it } from "vitest";
import { rollSpawnGapMs, type ZoneEncounterPlan } from "./encounter-schedule";

describe("rollSpawnGapMs", () => {
	const plan: ZoneEncounterPlan = {
		encountersBeforeBoss: 15,
		gapBetweenSpawns: { min: 1.5, max: 3 },
	};

	it("returns a value within [min, max] in ms across many rolls", () => {
		for (let i = 0; i < 200; i++) {
			const ms = rollSpawnGapMs(plan);
			expect(ms).toBeGreaterThanOrEqual(1500);
			expect(ms).toBeLessThanOrEqual(3000);
			expect(Number.isInteger(ms)).toBe(true);
		}
	});

	it("collapses to a constant when min === max", () => {
		const fixed: ZoneEncounterPlan = {
			encountersBeforeBoss: 15,
			gapBetweenSpawns: { min: 2, max: 2 },
		};
		for (let i = 0; i < 50; i++) {
			expect(rollSpawnGapMs(fixed)).toBe(2000);
		}
	});

	it("varies across calls when the range is wide", () => {
		const wide: ZoneEncounterPlan = {
			encountersBeforeBoss: 15,
			gapBetweenSpawns: { min: 1, max: 10 },
		};
		const samples = new Set<number>();
		for (let i = 0; i < 50; i++) samples.add(rollSpawnGapMs(wide));
		// With a 9-second range rolled at integer ms, hitting fewer than 20
		// distinct values across 50 samples would be extraordinary.
		expect(samples.size).toBeGreaterThan(20);
	});
});
