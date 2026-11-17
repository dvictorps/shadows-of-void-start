import { describe, expect, it } from "vitest";

import {
	chance,
	hashStringToUnit,
	pickWeighted,
	randInt,
	seededRng,
} from "./rng";

describe("hashStringToUnit", () => {
	it("is deterministic for the same input and salt", () => {
		expect(hashStringToUnit("k57a3b9c2d")).toBe(hashStringToUnit("k57a3b9c2d"));
		expect(hashStringToUnit("k57a3b9c2d", 7)).toBe(
			hashStringToUnit("k57a3b9c2d", 7),
		);
	});

	it("stays in [0, 1), including empty and non-BMP input", () => {
		const inputs = ["", "a", "item-0", "Gralfor 💀", "x".repeat(500)];
		for (const input of inputs) {
			const value = hashStringToUnit(input);
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThan(1);
		}
	});

	it("salt changes the output", () => {
		const id = "evt-42";
		const salted = new Set([0, 1, 2, 3].map((s) => hashStringToUnit(id, s)));
		expect(salted.size).toBe(4);
	});

	it("spreads sequential ids across the range", () => {
		const values = Array.from({ length: 400 }, (_, i) =>
			hashStringToUnit(`evt-${i}`),
		);
		expect(new Set(values).size).toBe(values.length);
		const buckets = Array.from({ length: 10 }, () => 0);
		for (const v of values) buckets[Math.floor(v * 10)] += 1;
		for (const count of buckets) {
			expect(count).toBeGreaterThan(20);
			expect(count).toBeLessThan(60);
		}
	});
});

describe("seededRng", () => {
	it("repeats the same floats and ids for the same seed", () => {
		const a = seededRng(42);
		const b = seededRng(42);
		const draws = (r: ReturnType<typeof seededRng>) => [
			r.unit(),
			r.unit(),
			r.id(),
			r.unit(),
		];
		expect(draws(a)).toEqual(draws(b));
	});

	it("gives a different stream for a different seed", () => {
		expect(seededRng(1).unit()).not.toBe(seededRng(2).unit());
	});

	it("stays in [0, 1) and spreads across it", () => {
		const r = seededRng(7);
		const values = Array.from({ length: 2000 }, () => r.unit());
		expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
		expect(Math.max(...values)).toBeLessThan(1);
		const low = values.filter((v) => v < 0.5).length;
		expect(low).toBeGreaterThan(900);
		expect(low).toBeLessThan(1100);
	});

	it("makes UUID v4-shaped ids", () => {
		expect(seededRng(3).id()).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);
	});

	it("drives the helpers when passed in", () => {
		const roll = (seed: number) => {
			const r = seededRng(seed);
			return [
				randInt(1, 100, r),
				chance(0.5, r),
				pickWeighted(["a", "b", "c"], () => 1, r),
			];
		};
		expect(roll(9)).toEqual(roll(9));
	});
});
