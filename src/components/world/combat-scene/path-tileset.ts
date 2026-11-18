import { type PathLayout, roadSides, type Side } from "./path-layout";

export type RoadSidesKey =
	| "left,right"
	| "down,up"
	| "down,right"
	| "down,left"
	| "right,up"
	| "left,up";

export type PathTileset = {
	ground: { href: string; cells: number };
	pieces: Readonly<Record<RoadSidesKey, readonly string[]>>;
};

const FOREST_DIR = "/assets/sprites/zona/floresta";
const forest = (name: string) => `${FOREST_DIR}/caminho-${name}.png`;

const FOREST: PathTileset = {
	ground: { href: `${FOREST_DIR}/grama.png`, cells: 3 },
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
