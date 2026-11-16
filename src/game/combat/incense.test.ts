import { describe, expect, it } from "vitest";

import { canLightIncense } from "./incense";
import type { CombatState } from "./types";

type Input = Parameters<typeof canLightIncense>[0];

const BASE: Input = {
	incense: 1,
	state: "searching",
	enemyRarity: undefined,
	isBossNode: false,
	ambushActive: false,
};

const can = (over: Partial<Input>) => canLightIncense({ ...BASE, ...over });

describe("canLightIncense", () => {
	it("allows it while searching with incense in stock", () => {
		expect(can({})).toBe(true);
	});

	it("needs at least one incense", () => {
		expect(can({ incense: 0 })).toBe(false);
	});

	it.each<CombatState>([
		"rare_intro",
		"boss_intro",
		"acampamento",
		"miniboss_victory",
	])("blocks it during %s", (state) => {
		expect(can({ state })).toBe(false);
	});

	it("allows it against an engaged normal or magic monster", () => {
		expect(can({ state: "engaged", enemyRarity: "normal" })).toBe(true);
		expect(can({ state: "engaged", enemyRarity: "magic" })).toBe(true);
	});

	it("blocks it against an engaged rare or unique", () => {
		expect(can({ state: "engaged", enemyRarity: "rare" })).toBe(false);
		expect(can({ state: "engaged", enemyRarity: "unique" })).toBe(false);
	});

	it("allows it on the victory beat after a rare", () => {
		expect(can({ state: "victory", enemyRarity: "rare" })).toBe(true);
	});

	it("blocks it inside a boss node and during an ambush", () => {
		expect(can({ isBossNode: true })).toBe(false);
		expect(can({ ambushActive: true })).toBe(false);
	});
});
