import { describe, expect, it } from "vitest";

import { fightBackdropFor } from "./fight-backdrop";

describe("fightBackdropFor", () => {
	it("gives the Floresta Inicial its forest scenery", () => {
		expect(fightBackdropFor("forest_starter")).toBe(
			"/assets/sprites/cenarios/floresta-1.png",
		);
	});

	it("keeps the black arena for zones without scenery", () => {
		expect(fightBackdropFor("forest_profunda")).toBeNull();
		expect(fightBackdropFor("constructor")).toBeNull();
	});
});
