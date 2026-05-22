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
		campFractions: [0.5],
	};

	it("anchors the threshold near its fraction (±10% jitter)", () => {
		const budgetMs = plan.calmariaBudgetSeconds * 1000; // 35000
		for (let i = 0; i < 100; i++) {
			const [threshold] = rollCampThresholdsMs(plan);
			// 0.5 ± 0.10 → 0.40–0.60 → 14000–21000
			expect(threshold).toBeGreaterThanOrEqual(0.4 * budgetMs);
			expect(threshold).toBeLessThanOrEqual(0.6 * budgetMs);
		}
	});

	it("returns multiple thresholds sorted ascending", () => {
		const multi: ZoneEncounterPlan = {
			calmariaBudgetSeconds: 60,
			gapBetweenSpawns: { min: 1.5, max: 3 },
			campFractions: [0.33, 0.66],
		};
		for (let i = 0; i < 100; i++) {
			const thresholds = rollCampThresholdsMs(multi);
			expect(thresholds).toHaveLength(2);
			expect(thresholds[0]).toBeLessThan(thresholds[1]);
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
