import { describe, expect, it } from "vitest";

import { seededRng } from "#/lib/rng";

import {
	DEFAULT_ENCOUNTER_PLAN,
	encounterPlanForNode,
	rollAmbushSchedule,
	rollCampThresholdsMs,
	rollSpawnGapMs,
	type ZoneEncounterPlan,
} from "./encounter-schedule";

describe("rollSpawnGapMs", () => {
	it("follows the injected rng", () => {
		const roll = (seed: number) => [
			rollSpawnGapMs(DEFAULT_ENCOUNTER_PLAN, seededRng(seed)),
			rollAmbushSchedule(DEFAULT_ENCOUNTER_PLAN, seededRng(seed)),
		];
		expect(roll(9)).toEqual(roll(9));
	});

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
		const budgetMs = plan.calmariaBudgetSeconds * 1000;
		for (let i = 0; i < 100; i++) {
			const [threshold] = rollCampThresholdsMs(plan);
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

describe("rollAmbushSchedule", () => {
	const plan: ZoneEncounterPlan = {
		calmariaBudgetSeconds: 40,
		gapBetweenSpawns: { min: 1.5, max: 3 },
		campFractions: [0.5],
		ambushes: {
			fractions: [0.3, 0.75],
			packSize: { min: 3, max: 5 },
			gapWithinPackMs: 800,
			magicChance: 0.5,
		},
	};

	it("returns empty array when the plan has no ambushes", () => {
		const noAmbush: ZoneEncounterPlan = {
			calmariaBudgetSeconds: 35,
			gapBetweenSpawns: { min: 1.5, max: 3 },
			campFractions: [0.5],
		};
		expect(rollAmbushSchedule(noAmbush)).toEqual([]);
	});

	it("anchors each ambush near its fraction (±15% jitter)", () => {
		const budgetMs = plan.calmariaBudgetSeconds * 1000;
		for (let i = 0; i < 100; i++) {
			const [a, b] = rollAmbushSchedule(plan);
			expect(a.thresholdMs).toBeGreaterThanOrEqual(0.15 * budgetMs);
			expect(a.thresholdMs).toBeLessThanOrEqual(0.45 * budgetMs);
			expect(b.thresholdMs).toBeGreaterThanOrEqual(0.6 * budgetMs);
			expect(b.thresholdMs).toBeLessThanOrEqual(0.9 * budgetMs);
		}
	});

	it("rolls a pack size within [min, max] per ambush", () => {
		for (let i = 0; i < 100; i++) {
			for (const a of rollAmbushSchedule(plan)) {
				expect(a.packSize).toBeGreaterThanOrEqual(3);
				expect(a.packSize).toBeLessThanOrEqual(5);
				expect(Number.isInteger(a.packSize)).toBe(true);
			}
		}
	});

	it("returns ambushes sorted by threshold ascending", () => {
		for (let i = 0; i < 50; i++) {
			const out = rollAmbushSchedule(plan);
			for (let j = 1; j < out.length; j++) {
				expect(out[j].thresholdMs).toBeGreaterThanOrEqual(
					out[j - 1].thresholdMs,
				);
			}
		}
	});
});

describe("encounterPlanForNode", () => {
	const zonePlan: ZoneEncounterPlan = {
		calmariaBudgetSeconds: 40,
		gapBetweenSpawns: { min: 2, max: 4 },
		campFractions: [0.33, 0.66],
	};

	it("uses the zone's declared plan", () => {
		expect(encounterPlanForNode({ encounterPlan: zonePlan })).toBe(zonePlan);
	});

	it("turns a boss node's warmup into the calmaria budget, with no camps or ambushes", () => {
		const plan = encounterPlanForNode({
			bossNode: {
				bossId: "gralfor",
				warmupSeconds: 30,
				gauntlet: { fights: 3, monsterPool: ["goblin"] },
			},
		});
		expect(plan.calmariaBudgetSeconds).toBe(30);
		expect(plan.campFractions).toEqual([]);
		expect(plan.ambushes).toBeUndefined();
	});

	it("falls back to the default plan without a node or a declared plan", () => {
		expect(encounterPlanForNode(null)).toBe(DEFAULT_ENCOUNTER_PLAN);
		expect(encounterPlanForNode({})).toBe(DEFAULT_ENCOUNTER_PLAN);
	});
});
