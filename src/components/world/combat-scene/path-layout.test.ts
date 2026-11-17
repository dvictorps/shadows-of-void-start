import { describe, expect, it } from "vitest";

import { seededRng } from "#/lib/rng";

import {
	cellIndexAt,
	type PathCell,
	type PathLayout,
	pointAt,
	rollPathLayout,
} from "./path-layout";

const distance = (a: PathCell, b: PathCell) =>
	Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const steps = (a: PathCell, b: PathCell) =>
	Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

describe("rollPathLayout", () => {
	it("walks the asked number of tiles, one step at a time, inside its box", () => {
		for (let seed = 0; seed < 100; seed++) {
			const { cells, cols, rows } = rollPathLayout(35, seededRng(seed));
			expect(cells).toHaveLength(35);
			for (let i = 1; i < cells.length; i++) {
				expect(steps(cells[i - 1], cells[i])).toBe(1);
			}
			for (const cell of cells) {
				expect(cell.x).toBeGreaterThanOrEqual(0);
				expect(cell.x).toBeLessThan(cols);
				expect(cell.y).toBeGreaterThanOrEqual(0);
				expect(cell.y).toBeLessThan(rows);
			}
		}
	});

	it("never touches itself, not even at a corner, so it reads as one road", () => {
		for (let seed = 0; seed < 100; seed++) {
			const { cells } = rollPathLayout(62, seededRng(seed));
			for (let i = 0; i < cells.length; i++) {
				for (let j = i + 3; j < cells.length; j++) {
					expect(distance(cells[i], cells[j])).toBeGreaterThan(1);
				}
			}
		}
	});

	it("heads off in different directions across rolls", () => {
		const headings = new Set(
			Array.from({ length: 40 }, (_, seed) => {
				const { cells } = rollPathLayout(35, seededRng(seed));
				const [a, b] = cells;
				return `${b.x - a.x},${b.y - a.y}`;
			}),
		);
		expect(headings.size).toBe(4);
	});

	it("is reproducible under the same seed", () => {
		expect(rollPathLayout(35, seededRng(5))).toEqual(
			rollPathLayout(35, seededRng(5)),
		);
	});
});

describe("positions along the path", () => {
	const layout: PathLayout = {
		cols: 2,
		rows: 2,
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

	it("interpolates the walker between tiles", () => {
		expect(pointAt(layout, 0.25)).toEqual({ x: 0, y: 0.5 });
		expect(pointAt(layout, 0.75)).toEqual({ x: 0.5, y: 1 });
		expect(pointAt(layout, 1)).toEqual({ x: 1, y: 1 });
	});
});
