import { describe, expect, it } from "vitest";

import { seededRng } from "#/lib/rng";

import { type PathLayout, rollPathLayout } from "./path-layout";
import { pathTilesetFor, roadPieceAt } from "./path-tileset";

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
		expect(forest?.ground.href).toBe("/assets/sprites/zona/floresta/grama.png");
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
