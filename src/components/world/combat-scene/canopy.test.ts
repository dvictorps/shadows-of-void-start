import { describe, expect, it } from "vitest";

import { CANOPY_PERIOD, CANOPY_SIZE, canopyTrees } from "./canopy";

const trees = canopyTrees();

describe("canopyTrees", () => {
	it("draws back rows first so each row's tips overlap the row behind", () => {
		const ys = trees.map((t) => t.y);
		expect(ys).toEqual(ys.toSorted((a, b) => a - b));
		expect(CANOPY_SIZE).toBeGreaterThan(1);
	});

	it("anchors every tree on its cell's bottom edge", () => {
		for (const tree of trees) {
			expect(Number.isInteger(tree.y + CANOPY_SIZE)).toBe(true);
		}
	});

	it("covers the whole pattern tile", () => {
		for (const at of [0, 0.5, 1, 1.5, 1.99]) {
			const coveredX = trees.some(
				(t) => t.x <= at && at <= t.x + CANOPY_SIZE && t.y <= at,
			);
			expect(coveredX).toBe(true);
		}
	});

	it("repeats seamlessly: the same spot one period over has the same tree", () => {
		const wrap = (v: number) =>
			((v % CANOPY_PERIOD) + CANOPY_PERIOD) % CANOPY_PERIOD;
		const spots = new Set(trees.map((t) => `${wrap(t.x)},${wrap(t.y)}`));
		const spotFlips = new Set(
			trees.map((t) => `${wrap(t.x)},${wrap(t.y)},${t.flip}`),
		);
		expect(spotFlips.size).toBe(spots.size);
	});
});
