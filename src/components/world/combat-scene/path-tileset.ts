export type PathTileset = { road: string; ground: string };

const FOREST: PathTileset = {
	road: "/assets/sprites/zona/floresta/caminho.png",
	ground: "/assets/sprites/zona/floresta/copa.png",
};

const PATH_TILESET_BY_ZONE = new Map<string, PathTileset>([
	["forest_starter", FOREST],
]);

export function pathTilesetFor(zoneId: string): PathTileset | null {
	return PATH_TILESET_BY_ZONE.get(zoneId) ?? null;
}
