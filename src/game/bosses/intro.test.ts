import { describe, expect, it } from "vitest";

import { BOSS_INTRO_STAGE_MS_DEFAULT } from "../combat/types";
import { GRALFOR } from "./gralfor";
import { bossIntroStageMs, bossIntroStageMsFor } from "./intro";
import type { BossCinematicConfig } from "./types";

const SLOW: BossCinematicConfig = {
	...GRALFOR.cinematic,
	spriteFadeInMs: 1500,
	sfxBeatMs: 1100,
};

describe("bossIntroStageMs", () => {
	it("takes sprite and impact from the boss, name and hp from the defaults", () => {
		expect(bossIntroStageMs(SLOW)).toEqual({
			sprite: 1500,
			impact: 1100,
			name: BOSS_INTRO_STAGE_MS_DEFAULT.name,
			hp: BOSS_INTRO_STAGE_MS_DEFAULT.hp,
		});
	});

	it("keeps the stage order", () => {
		expect(Object.keys(bossIntroStageMs(SLOW))).toEqual(
			Object.keys(BOSS_INTRO_STAGE_MS_DEFAULT),
		);
	});

	it("returns the same table for the same boss", () => {
		expect(bossIntroStageMs(SLOW)).toBe(bossIntroStageMs(SLOW));
	});

	it("falls back to the defaults without a boss", () => {
		expect(bossIntroStageMs()).toBe(BOSS_INTRO_STAGE_MS_DEFAULT);
	});

	it("looks the engaged enemy's boss up, defaults for a non-boss", () => {
		expect(
			bossIntroStageMsFor({ def: { id: "gralfor" }, rarity: "unique" }),
		).toBe(bossIntroStageMs(GRALFOR.cinematic));
		expect(
			bossIntroStageMsFor({ def: { id: "gralfor" }, rarity: "rare" }),
		).toBe(BOSS_INTRO_STAGE_MS_DEFAULT);
		expect(bossIntroStageMsFor(null)).toBe(BOSS_INTRO_STAGE_MS_DEFAULT);
	});
});
