import { type PathLayout, roadSides, type Side } from "./path-layout";

export type RoadSidesKey =
	| "left,right"
	| "down,up"
	| "down,right"
	| "down,left"
	| "right,up"
	| "left,up";

export type PathTileset = {
	ground: readonly (readonly [string, string, string])[];
	pieces: Readonly<Record<RoadSidesKey, readonly string[]>>;
};

const FOREST_DIR = "/assets/sprites/zona/floresta";
const forest = (name: string) => `${FOREST_DIR}/caminho-${name}.png`;
const grass = (row: number, col: number) =>
	`${FOREST_DIR}/grama-${row}-${col}.png`;
const grassRow = (row: number): readonly [string, string, string] => [
	grass(row, 0),
	grass(row, 1),
	grass(row, 2),
];

const FOREST: PathTileset = {
	ground: [grassRow(0), grassRow(1), grassRow(2), grassRow(3)],
	pieces: {
		"left,right": [forest("horizontal-1"), forest("horizontal-2")],
		"down,up": [forest("vertical-1"), forest("vertical-2")],
		"down,right": [forest("curva-direita-baixo")],
		"down,left": [forest("curva-esquerda-baixo")],
		"right,up": [forest("curva-direita-cima")],
		"left,up": [forest("curva-esquerda-cima")],
	},
};

const PATH_TILESET_BY_ZONE = new Map<string, PathTileset>([
	["forest_starter", FOREST],
]);

export function pathTilesetFor(zoneId: string): PathTileset | null {
	return PATH_TILESET_BY_ZONE.get(zoneId) ?? null;
}

const SIDES_KEY = new Map<string, RoadSidesKey>(
	(
		[
			"left,right",
			"down,up",
			"down,right",
			"down,left",
			"right,up",
			"left,up",
		] satisfies RoadSidesKey[]
	).map((k) => [k, k]),
);

function sidesKey(sides: readonly Side[]): RoadSidesKey | undefined {
	return SIDES_KEY.get(sides.toSorted().join(","));
}

export function roadPieceAt(
	tileset: PathTileset,
	layout: PathLayout,
	index: number,
): string | null {
	const key = sidesKey(roadSides(layout, index));
	const variants = key ? tileset.pieces[key] : [];
	if (variants.length === 0) return null;
	const cell = layout.cells[index];
	return variants[(cell.x + cell.y) % variants.length];
}

function edgeIndex(at: number, size: number): 0 | 1 | 2 {
	if (size > 1 && at === 0) return 0;
	if (size > 1 && at === size - 1) return 2;
	return 1;
}

export function groundTileAt(
	tileset: PathTileset,
	layout: PathLayout,
	x: number,
	y: number,
): string {
	const { ground } = tileset;
	const col = edgeIndex(x, layout.cols);
	const band = edgeIndex(y, layout.rows);
	if (band === 0) return ground[0][col];
	if (band === 2) return ground.at(-1)[col];
	return ground[1 + ((x + y) % (ground.length - 2))][col];
}
