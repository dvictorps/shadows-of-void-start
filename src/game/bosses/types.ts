import type { MonsterDefinition } from "../monsters/types";

export type BossId = "gralfor";

export type BossTemplate = MonsterDefinition;

export interface BossCinematicConfig {
	spriteFadeInMs: number;
	entrySfx: string;
	sfxBeatMs: number;
	screenshake: {
		amplitudePx: number;
		durationMs: number;
	};
	deathSfx: string;
}

export interface BossConfig {
	id: BossId;
	nameKey: string;
	nameplateColor: string;
	nameplateShadow: string;
	level: number;
	template: BossTemplate;
	cinematic: BossCinematicConfig;
}
