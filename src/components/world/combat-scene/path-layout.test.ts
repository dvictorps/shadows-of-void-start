import { describe, expect, it } from "vitest";

import { seededRng } from "#/lib/rng";

import {
	cellIndexAt,
	PATH_ROWS,
	type PathLayout,
	pointAt,
	rollPathLayout,
	stopCellIndex,
} from "./path-layout";

const adjacent = (a: { x: number; y: number }, b: { x: number; y: number }) =>
	Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

describe("rollPathLayout", () => {
	it("walks from the first column to the last, one tile at a time, inside the grid", () => {
		for (let seed = 0; seed < 100; seed++) {
			const layout = rollPathLayout(35_000, seededRng(seed));
			const { cells, cols } = layout;
			expect(cells[0].x).toBe(0);
			expect(cells.at(-1)?.x).toBe(cols - 1);
			for (let i = 1; i < cells.length; i++) {
				expect(adjacent(cells[i - 1], cells[i])).toBe(true);
			}
			for (const cell of cells) {
				expect(cell.y).toBeGreaterThanOrEqual(0);
				expect(cell.y).toBeLessThan(PATH_ROWS);
			}
		}
	});

	it("never crosses itself", () => {
		for (let seed = 0; seed < 100; seed++) {
			const { cells } = rollPathLayout(50_000, seededRng(seed));
			const keys = new Set(cells.map((c) => `${c.x},${c.y}`));
			expect(keys.size).toBe(cells.length);
		}
	});

	it("grows with the budget", () => {
		const short = rollPathLayout(26_000, seededRng(3)).cells.length;
		const long = rollPathLayout(44_000, seededRng(3)).cells.length;
		expect(long).toBeGreaterThan(short);
	});

	it("is reproducible under the same seed", () => {
		expect(rollPathLayout(35_000, seededRng(5))).toEqual(
			rollPathLayout(35_000, seededRng(5)),
		);
	});
});

describe("positions along the path", () => {
	const layout: PathLayout = {
		cols: 2,
		rows: PATH_ROWS,
		cells: [
			{ x: 0, y: 0 },
			{ x: 0, y: 1 },
			{ x: 1, y: 1 },
		],
	};

	it("maps a fraction of the route to its nearest tile", () => {
		expect(cellIndexAt(layout, 0)).toBe(0);
		expect(cellIndexAt(layout, 0.4)).toBe(1);
		expect(cellIndexAt(layout, 1)).toBe(2);
		expect(cellIndexAt(layout, 2)).toBe(2);
	});

	it("keeps every stop off the exit tile", () => {
		expect(stopCellIndex(layout, 0.4)).toBe(1);
		expect(stopCellIndex(layout, 0.99)).toBe(1);
	});

	it("interpolates the walker between tiles", () => {
		expect(pointAt(layout, 0.25)).toEqual({ x: 0, y: 0.5 });
		expect(pointAt(layout, 0.75)).toEqual({ x: 0.5, y: 1 });
		expect(pointAt(layout, 1)).toEqual({ x: 1, y: 1 });
	});
});
