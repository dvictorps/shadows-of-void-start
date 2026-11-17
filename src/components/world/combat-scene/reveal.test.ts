import { describe, expect, it } from "vitest";

import { arenaView } from "./reveal";

describe("arenaView", () => {
	it("shows the path while exploring", () => {
		expect(arenaView("searching", false)).toBe("path");
	});

	it("stays on the fight between the mobs of an ambush pack", () => {
		expect(arenaView("searching", true)).toBe("fight");
	});

	it("shows the fight from the intro to the zone-complete panel", () => {
		for (const state of [
			"rare_intro",
			"boss_intro",
			"engaged",
			"victory",
			"miniboss_victory",
		] as const) {
			expect(arenaView(state, false)).toBe("fight");
		}
	});

	it("cuts to the camp screen in a camp", () => {
		expect(arenaView("acampamento", false)).toBe("camp");
		expect(arenaView("acampamento", true)).toBe("camp");
	});
});
