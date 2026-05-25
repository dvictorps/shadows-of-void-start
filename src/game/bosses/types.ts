import type { MonsterDefinition } from "../monsters/types";

// Bosses are handcrafted single-identity enemies (`rarity: "unique"`). They
// don't roll affixes, don't share the regular MONSTERS registry, and own
// their cinematic + nameplate config per CONTEXT.md → Boss / Boss Cinematic.
//
// The id space is independent from MonsterId — a future grep for "gralfor"
// finds only this folder. Combat callers detect a boss via the spawning
// node's `bossNode` config, not by looking up MONSTERS.

export type BossId = "gralfor";

// Mirrors MonsterDefinition.baseStats so a boss template can flow through
// scaleMonsterStats unchanged. Resistance overrides are first-class here
// (every boss declares them), unlike the optional field on MonsterDefinition.
export interface BossTemplate
	extends Pick<MonsterDefinition, "id" | "name" | "sprite" | "xpReward"> {
	baseStats: MonsterDefinition["baseStats"];
}

export interface BossCinematicConfig {
	/** Duration the sprite fade-in holds before the impact beat fires. */
	spriteFadeInMs: number;
	/** Path under public/assets/sounds/sfx/ — e.g. "bosses/gralfor.wav". */
	entrySfx: string;
	/** Duration the impact beat (sfx + screenshake) holds before the name. */
	sfxBeatMs: number;
	screenshake: {
		amplitudePx: number;
		durationMs: number;
	};
	/** Path under public/assets/sounds/sfx/ — fires on boss HP → 0. */
	deathSfx: string;
}

export interface BossConfig {
	id: BossId;
	/** Paraglide message key (e.g. "boss_gralfor_name"). Resolves per locale. */
	nameKey: string;
	/** Nameplate color override — bosses don't use RARITY_NAMEPLATE_COLOR.unique. */
	nameplateColor: string;
	/** CSS box-shadow string. Reinforces the boss color. */
	nameplateShadow: string;
	/** Fixed boss level — overrides the node's `level ± 1` scaling. */
	level: number;
	template: BossTemplate;
	cinematic: BossCinematicConfig;
}
