import { describe, expect, it } from "vitest";

import { seededRng } from "#/lib/rng";

import { type PathLayout, rollPathLayout } from "./path-layout";
import { groundTileAt, pathTilesetFor, roadPieceAt } from "./path-tileset";

const forest = pathTilesetFor("forest_starter");

function layoutOf(cells: Array<[number, number]>): PathLayout {
	return {
		cols: Math.max(...cells.map(([x]) => x)) + 1,
		rows: Math.max(...cells.map(([, y]) => y)) + 1,
		cells: cells.map(([x, y]) => ({ x, y })),
	};
}

describe("pathTilesetFor", () => {
	it("gives the Floresta Inicial its road pieces and grass", () => {
		expect(forest?.ground).toHaveLength(4);
		expect(Object.keys(forest?.pieces ?? {}).toSorted()).toEqual([
			"down,left",
			"down,right",
			"down,up",
			"left,right",
			"left,up",
			"right,up",
		]);
	});

	it("leaves zones without art on the plain road", () => {
		expect(pathTilesetFor("cripta")).toBeNull();
		expect(pathTilesetFor("constructor")).toBeNull();
	});
});

describe("roadPieceAt", () => {
	if (!forest) throw new Error("forest tileset missing");

	it("turns each corner with the piece open toward both neighbours", () => {
		const layout = layoutOf([
			[0, 0],
			[1, 0],
			[1, 1],
			[2, 1],
		]);
		expect(roadPieceAt(forest, layout, 1)).toBe(
			"/assets/sprites/zona/floresta/caminho-curva-esquerda-baixo.png",
		);
		expect(roadPieceAt(forest, layout, 2)).toBe(
			"/assets/sprites/zona/floresta/caminho-curva-direita-cima.png",
		);
	});

	it("opens the entrance and the exit onto the map's edge", () => {
		const layout = layoutOf([
			[0, 0],
			[1, 0],
			[1, 1],
		]);
		expect(roadPieceAt(forest, layout, 0)).toMatch(/horizontal/);
		expect(roadPieceAt(forest, layout, 2)).toMatch(/vertical/);
	});

	it("has a piece for every cell of a rolled road", () => {
		for (let seed = 0; seed < 50; seed++) {
			const layout = rollPathLayout(40, seededRng(seed));
			const pieces = layout.cells.map((_, i) => roadPieceAt(forest, layout, i));
			expect(pieces.filter((piece) => piece === null)).toEqual([]);
		}
	});
});

describe("groundTileAt", () => {
	if (!forest) throw new Error("forest tileset missing");
	const layout: PathLayout = { cols: 4, rows: 4, cells: [{ x: 0, y: 0 }] };
	const tile = (x: number, y: number) =>
		groundTileAt(forest, layout, x, y).replace(/^.*grama-/, "");

	it("frames the map with the border tiles and its corners", () => {
		expect(tile(0, 0)).toBe("0-0.png");
		expect(tile(1, 0)).toBe("0-1.png");
		expect(tile(3, 0)).toBe("0-2.png");
		expect(tile(0, 3)).toBe("3-0.png");
		expect(tile(2, 3)).toBe("3-1.png");
		expect(tile(3, 3)).toBe("3-2.png");
		expect(tile(0, 1)).toMatch(/^[12]-0\.png$/);
		expect(tile(3, 2)).toMatch(/^[12]-2\.png$/);
	});

	it("fills the middle with the centre tiles, alternating their variants", () => {
		expect(new Set([tile(1, 1), tile(2, 1), tile(1, 2), tile(2, 2)])).toEqual(
			new Set(["1-1.png", "2-1.png"]),
		);
	});

	it("uses the middle band when the map is one cell thin", () => {
		const thin: PathLayout = { cols: 5, rows: 1, cells: [{ x: 0, y: 0 }] };
		expect(groundTileAt(forest, thin, 2, 0)).toMatch(/grama-[12]-1\.png$/);
	});
});
