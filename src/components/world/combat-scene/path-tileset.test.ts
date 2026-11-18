import { describe, expect, it } from "vitest";

import { pathTilesetFor } from "./path-tileset";

describe("pathTilesetFor", () => {
	it("gives the forest its road and canopy sprites", () => {
		expect(pathTilesetFor("forest_starter")).toEqual({
			road: "/assets/sprites/zona/floresta/caminho.png",
			ground: "/assets/sprites/zona/floresta/copa.png",
		});
	});

	it("leaves zones without art on the plain road", () => {
		expect(pathTilesetFor("cripta")).toBeNull();
		expect(pathTilesetFor("constructor")).toBeNull();
	});
});
