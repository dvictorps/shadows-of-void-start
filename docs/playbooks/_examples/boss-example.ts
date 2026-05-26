// Sentinel example for docs/playbooks/adding-a-boss.md — step 1.
// If this stops compiling, the playbook is out of date.
//
// Demonstrates: a unique-rarity boss declaration — proper-name paraglide
// key, per-boss nameplate color, declared resistance sheet (including
// negative cold = vulnerability), and the configurable cinematic.

import type { BossConfig } from "#/game/bosses/types";

export const PLAYBOOK_BOSS_EXAMPLE: BossConfig = {
	id: "gralfor",
	nameKey: "boss_gralfor_name",
	nameplateColor: "#ff8c3a",
	nameplateShadow:
		"0 0 22px rgba(255, 140, 58, 0.75), 0 2px 4px rgba(0, 0, 0, 0.9)",
	level: 17,
	template: {
		id: "gralfor",
		name: "Gralfor, O Persistente",
		sprite: "/assets/sprites/bosses/gralfor.png",
		baseStats: {
			hp: 200,
			attackSpeed: 0.9,
			physicalDamage: { min: 6, max: 10 },
			elementalDamage: [{ element: "Fire", min: 6, max: 10 }],
			resistances: { fire: 50, cold: -25, lightning: 0, void: 0 },
		},
		xpReward: 45,
		allowedRarities: ["unique"],
	},
	cinematic: {
		spriteFadeInMs: 900,
		entrySfx: "bosses/gralfor.wav",
		sfxBeatMs: 600,
		screenshake: { amplitudePx: 12, durationMs: 350 },
		deathSfx: "bosses/gralfordead.wav",
	},
};
