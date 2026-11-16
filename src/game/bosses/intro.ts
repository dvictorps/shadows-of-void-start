import { BOSS_INTRO_STAGE_MS_DEFAULT } from "../combat/types";
import { getBossConfig } from "./data";
import type { BossCinematicConfig } from "./types";

type IntroStageMs = typeof BOSS_INTRO_STAGE_MS_DEFAULT;

// One table per boss config, so the same boss always gets the same object
// (the intro cascade re-arms its timer on a new table).
const TABLES = new WeakMap<BossCinematicConfig, IntroStageMs>();

/**
 * How long each boss-intro stage holds: sprite and impact from the boss's
 * cinematic config, name and hp shared by every boss (CONTEXT.md → Boss
 * Cinematic). No config (not a boss) → the defaults.
 */
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

/** `bossIntroStageMs` for the engaged enemy: its boss's table when it is a
 * boss (`rarity: "unique"`), the defaults otherwise. */
export function bossIntroStageMsFor(
	enemy: Parameters<typeof getBossConfig>[0] | null,
): IntroStageMs {
	return bossIntroStageMs(enemy ? getBossConfig(enemy)?.cinematic : undefined);
}
