import type { Act } from "./types";

export const ACT_1: Act = {
	id: "act-1",
	name: "Act 1",
	// `name` is the English canonical label. UI looks up the translated string
	// via `m.zone_<id>()` (e.g., zone_city, zone_forest_starter).
	nodes: [
		{
			id: "city",
			name: "City",
			kind: "city",
			position: { x: 0.08, y: 0.5 },
			connections: [{ id: "forest_starter", distance: 3 }],
		},
		{
			id: "forest_starter",
			name: "Starter Forest",
			kind: "combat",
			position: { x: 0.2, y: 0.5 },
			connections: [
				{ id: "city", distance: 3 },
				{ id: "forest_profunda", distance: 4 },
			],
			monsterPool: ["goblin", "macaco", "morcego", "serpente"],
			level: 1,
			encounterPlan: {
				calmariaBudgetSeconds: 35,
				gapBetweenSpawns: { min: 1.5, max: 3 },
				campFractions: [0.5],
				ambushes: {
					fractions: [0.72],
					packSize: { min: 3, max: 4 },
					gapWithinPackMs: 800,
					magicChance: 0.5,
				},
			},
		},
		{
			id: "forest_profunda",
			name: "Deep Forest",
			kind: "combat",
			position: { x: 0.34, y: 0.42 },
			connections: [
				{ id: "forest_starter", distance: 4 },
				{ id: "pantano", distance: 4 },
			],
			monsterPool: ["goblin", "macaco", "morcego", "serpente"],
			level: 2,
			gatedBy: ["forest_starter"],
			encounterPlan: {
				calmariaBudgetSeconds: 42,
				gapBetweenSpawns: { min: 1.5, max: 3 },
				campFractions: [0.5],
				ambushes: {
					fractions: [0.72],
					packSize: { min: 3, max: 5 },
					gapWithinPackMs: 800,
					magicChance: 0.5,
				},
			},
		},
		{
			id: "pantano",
			name: "Putrid Swamp",
			kind: "combat",
			position: { x: 0.46, y: 0.55 },
			connections: [
				{ id: "forest_profunda", distance: 4 },
				{ id: "cripta", distance: 4 },
			],
			monsterPool: ["slime", "zumbi"],
			level: 4,
			gatedBy: ["forest_profunda"],
			encounterPlan: {
				calmariaBudgetSeconds: 45,
				gapBetweenSpawns: { min: 1.25, max: 2.75 },
				campFractions: [0.5],
				ambushes: {
					fractions: [0.7],
					packSize: { min: 3, max: 5 },
					gapWithinPackMs: 800,
					magicChance: 0.55,
				},
			},
		},
		{
			id: "cripta",
			name: "Crypt of the Fallen",
			kind: "combat",
			position: { x: 0.58, y: 0.42 },
			connections: [
				{ id: "pantano", distance: 4 },
				{ id: "castelo", distance: 4 },
			],
			monsterPool: ["esqueleto", "esqueleto_armadurado", "esqueleto_lanca"],
			level: 7,
			gatedBy: ["pantano"],
			encounterPlan: {
				calmariaBudgetSeconds: 47,
				gapBetweenSpawns: { min: 1.25, max: 2.5 },
				campFractions: [0.5],
				ambushes: {
					fractions: [0.3, 0.75],
					packSize: { min: 3, max: 5 },
					gapWithinPackMs: 800,
					magicChance: 0.6,
				},
			},
		},
		{
			id: "castelo",
			name: "Dark Castle",
			kind: "combat",
			position: { x: 0.72, y: 0.58 },
			connections: [
				{ id: "cripta", distance: 4 },
				{ id: "fenda_vazio", distance: 4 },
			],
			monsterPool: ["vampiro", "lich"],
			level: 10,
			gatedBy: ["cripta"],
			encounterPlan: {
				calmariaBudgetSeconds: 50,
				gapBetweenSpawns: { min: 1, max: 2.5 },
				campFractions: [0.5],
				ambushes: {
					fractions: [0.3, 0.75],
					packSize: { min: 4, max: 5 },
					gapWithinPackMs: 750,
					magicChance: 0.65,
				},
			},
		},
		{
			id: "fenda_vazio",
			name: "Void Rift",
			kind: "combat",
			position: { x: 0.78, y: 0.5 },
			connections: [
				{ id: "castelo", distance: 4 },
				{ id: "covil_gralfor", distance: 5 },
			],
			monsterPool: ["olho_do_vazio", "criatura_do_vazio"],
			level: 14,
			gatedBy: ["castelo"],
			encounterPlan: {
				calmariaBudgetSeconds: 50,
				gapBetweenSpawns: { min: 1, max: 2.25 },
				campFractions: [0.5],
				ambushes: {
					fractions: [0.3, 0.75],
					packSize: { min: 4, max: 5 },
					gapWithinPackMs: 700,
					magicChance: 0.7,
				},
			},
		},
		{
			id: "covil_gralfor",
			name: "Gralfor's Lair",
			kind: "boss",
			position: { x: 0.92, y: 0.5 },
			connections: [{ id: "fenda_vazio", distance: 5 }],
			level: 15,
			gatedBy: ["fenda_vazio"],
			bossNode: {
				bossId: "gralfor",
				gauntlet: {
					fights: 3,
					monsterPool: ["olho_do_vazio", "criatura_do_vazio"],
				},
			},
		},
	],
};
