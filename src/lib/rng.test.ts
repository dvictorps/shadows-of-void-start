import { describe, expect, it } from "vitest";

import { hashStringToUnit } from "./rng";

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
		// No collisions, and every tenth of [0, 1) gets a fair share (expected
		// 40 per bucket; a weak hash on sequential ids clusters badly).
		expect(new Set(values).size).toBe(values.length);
		const buckets = Array.from({ length: 10 }, () => 0);
		for (const v of values) buckets[Math.floor(v * 10)] += 1;
		for (const count of buckets) {
			expect(count).toBeGreaterThan(20);
			expect(count).toBeLessThan(60);
		}
	});
});
