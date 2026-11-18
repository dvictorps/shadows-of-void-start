import type { PathCell } from "./path-layout";

export type RoadPieceId =
	| "vertical"
	| "horizontal"
	| "cornerLeftDown"
	| "cornerLeftUp";

export type PathTileset = {
	road: Record<RoadPieceId, string>;
	ground: string;
};

export type RoadPiece = { id: RoadPieceId; flip: boolean };

const FOREST_DIR = "/assets/sprites/zona/floresta";

const FOREST: PathTileset = {
	road: {
		vertical: `${FOREST_DIR}/caminho-vertical.png`,
		horizontal: `${FOREST_DIR}/caminho-horizontal.png`,
		cornerLeftDown: `${FOREST_DIR}/caminho-curva-esquerda-baixo.png`,
		cornerLeftUp: `${FOREST_DIR}/caminho-curva-esquerda-cima.png`,
	},
	ground: `${FOREST_DIR}/copa.png`,
};

const PATH_TILESET_BY_ZONE = new Map<string, PathTileset>([
	["forest_starter", FOREST],
]);

export function pathTilesetFor(zoneId: string): PathTileset | null {
	return PATH_TILESET_BY_ZONE.get(zoneId) ?? null;
}

type Side = "left" | "right" | "up" | "down";

function sideOf(cell: PathCell, neighbour: PathCell | undefined): Side | null {
	if (!neighbour) return null;
	if (neighbour.x < cell.x) return "left";
	if (neighbour.x > cell.x) return "right";
	return neighbour.y < cell.y ? "up" : "down";
}

const HORIZONTAL_SIDES = new Set<Side | null>(["left", "right"]);

export function roadPieceAt(
	cells: readonly PathCell[],
	index: number,
): RoadPiece {
	const cell = cells[index];
	const sides = [
		sideOf(cell, index > 0 ? cells[index - 1] : undefined),
		sideOf(cell, cells[index + 1]),
	];
	const horizontal = sides.filter((side) => HORIZONTAL_SIDES.has(side));
	const vertical = sides.filter((side) => side === "up" || side === "down");
	if (vertical.length === 0) return { id: "horizontal", flip: false };
	if (horizontal.length === 0) return { id: "vertical", flip: false };
	return {
		id: vertical[0] === "down" ? "cornerLeftDown" : "cornerLeftUp",
		flip: horizontal[0] === "right",
	};
}
