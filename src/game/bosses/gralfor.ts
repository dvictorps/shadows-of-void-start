import type { BossConfig } from "./types";

// Gralfor, O Persistente — the act-1 boss. Half phys / half fire damage with
// fire resistance and cold vulnerability, forcing the player into either a
// cold-element build or a balanced mitigation profile. See CONTEXT.md →
// Boss + Act Boss. Stats calibrated against the level-14 olho_do_vazio rare
// (the strongest rare in the act): ~3.3× HP, ~1.3× damage, lvl 17.
export const GRALFOR: BossConfig = {
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
			hp: 300,
			attackSpeed: 0.9,
			physicalDamage: { min: 9, max: 15 },
			elementalDamage: [{ element: "Fire", min: 9, max: 15 }],
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
