import { BOSS_INTRO_STAGE_MS_DEFAULT } from "../combat/types";
import { getBossConfig } from "./data";
import type { BossCinematicConfig } from "./types";

type IntroStageMs = typeof BOSS_INTRO_STAGE_MS_DEFAULT;

const TABLES = new WeakMap<BossCinematicConfig, IntroStageMs>();

export function bossIntroStageMs(
	cinematic?: BossCinematicConfig,
): IntroStageMs {
	if (!cinematic) return BOSS_INTRO_STAGE_MS_DEFAULT;
	const cached = TABLES.get(cinematic);
	if (cached) return cached;
	const table = {
		...BOSS_INTRO_STAGE_MS_DEFAULT,
		sprite: cinematic.spriteFadeInMs,
		impact: cinematic.sfxBeatMs,
	};
	TABLES.set(cinematic, table);
	return table;
}

export function bossIntroStageMsFor(
	enemy: Parameters<typeof getBossConfig>[0] | null,
): IntroStageMs {
	return bossIntroStageMs(enemy ? getBossConfig(enemy)?.cinematic : undefined);
}
