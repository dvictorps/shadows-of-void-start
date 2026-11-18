import { describe, expect, it } from "vitest";

import { pathTilesetFor, roadPieceAt } from "./path-tileset";

describe("pathTilesetFor", () => {
	it("gives the forest its road pieces and canopy", () => {
		const forest = pathTilesetFor("forest_starter");
		expect(forest?.ground).toBe("/assets/sprites/zona/floresta/copa.png");
		expect(Object.keys(forest?.road ?? {}).toSorted()).toEqual([
			"cornerLeftDown",
			"cornerLeftUp",
			"horizontal",
			"vertical",
		]);
	});

	it("leaves zones without art on the plain road", () => {
		expect(pathTilesetFor("cripta")).toBeNull();
		expect(pathTilesetFor("constructor")).toBeNull();
	});
});

describe("roadPieceAt", () => {
	const piece = (cells: Array<[number, number]>, index: number) =>
		roadPieceAt(
			cells.map(([x, y]) => ({ x, y })),
			index,
		);

	it("lays straights along the walk, ends included", () => {
		const row: Array<[number, number]> = [
			[0, 0],
			[1, 0],
			[2, 0],
		];
		expect(piece(row, 0)).toEqual({ id: "horizontal", flip: false });
		expect(piece(row, 1)).toEqual({ id: "horizontal", flip: false });
		expect(piece(row, 2)).toEqual({ id: "horizontal", flip: false });
		const column: Array<[number, number]> = [
			[0, 0],
			[0, 1],
		];
		expect(piece(column, 0)).toEqual({ id: "vertical", flip: false });
		expect(piece(column, 1)).toEqual({ id: "vertical", flip: false });
	});

	it("picks the corner from the two open sides, mirroring the right-hand ones", () => {
		expect(
			piece(
				[
					[0, 1],
					[1, 1],
					[1, 2],
				],
				1,
			),
		).toEqual({ id: "cornerLeftDown", flip: false });
		expect(
			piece(
				[
					[0, 1],
					[1, 1],
					[1, 0],
				],
				1,
			),
		).toEqual({ id: "cornerLeftUp", flip: false });
		expect(
			piece(
				[
					[1, 0],
					[1, 1],
					[2, 1],
				],
				1,
			),
		).toEqual({ id: "cornerLeftUp", flip: true });
		expect(
			piece(
				[
					[2, 1],
					[1, 1],
					[1, 2],
				],
				1,
			),
		).toEqual({ id: "cornerLeftDown", flip: true });
	});
});
