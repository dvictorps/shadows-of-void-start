import { describe, expect, it } from "vitest";
import {
	rollCampThresholdsMs,
	rollSpawnGapMs,
	type ZoneEncounterPlan,
} from "./encounter-schedule";

describe("rollSpawnGapMs", () => {
	const plan: ZoneEncounterPlan = {
		calmariaBudgetSeconds: 35,
		gapBetweenSpawns: { min: 1.5, max: 3 },
		campFractions: [0.5],
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
			calmariaBudgetSeconds: 35,
			gapBetweenSpawns: { min: 2, max: 2 },
			campFractions: [],
		};
		for (let i = 0; i < 50; i++) {
			expect(rollSpawnGapMs(fixed)).toBe(2000);
		}
	});

	it("varies across calls when the range is wide", () => {
		const wide: ZoneEncounterPlan = {
			calmariaBudgetSeconds: 35,
			gapBetweenSpawns: { min: 1, max: 10 },
			campFractions: [],
		};
		const samples = new Set<number>();
		for (let i = 0; i < 50; i++) samples.add(rollSpawnGapMs(wide));
		// With a 9-second range rolled at integer ms, hitting fewer than 20
		// distinct values across 50 samples would be extraordinary.
		expect(samples.size).toBeGreaterThan(20);
	});
});

describe("rollCampThresholdsMs", () => {
	const plan: ZoneEncounterPlan = {
		calmariaBudgetSeconds: 35,
		gapBetweenSpawns: { min: 1.5, max: 3 },
		campFractions: [0.33, 0.66],
	};

	it("returns thresholds in ms sorted ascending", () => {
		for (let i = 0; i < 100; i++) {
			const thresholds = rollCampThresholdsMs(plan);
			expect(thresholds).toHaveLength(2);
			expect(thresholds[0]).toBeLessThan(thresholds[1]);
		}
	});

	it("anchors each threshold near its fraction (±3% jitter)", () => {
		const budgetMs = plan.calmariaBudgetSeconds * 1000; // 35000
		for (let i = 0; i < 100; i++) {
			const [low, high] = rollCampThresholdsMs(plan);
			// 0.33 ± 0.03 → 0.30–0.36 → 10500–12600
			expect(low).toBeGreaterThanOrEqual(0.3 * budgetMs);
			expect(low).toBeLessThanOrEqual(0.36 * budgetMs);
			// 0.66 ± 0.03 → 0.63–0.69 → 22050–24150
			expect(high).toBeGreaterThanOrEqual(0.63 * budgetMs);
			expect(high).toBeLessThanOrEqual(0.69 * budgetMs);
		}
	});

	it("returns empty array when the zone has no camps", () => {
		const noCamps: ZoneEncounterPlan = {
			calmariaBudgetSeconds: 35,
			gapBetweenSpawns: { min: 1.5, max: 3 },
			campFractions: [],
		};
		expect(rollCampThresholdsMs(noCamps)).toEqual([]);
	});
});
