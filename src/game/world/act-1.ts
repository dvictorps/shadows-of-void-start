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
				encountersBeforeBoss: 15,
				gapBetweenSpawns: { min: 1.5, max: 3 },
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
				encountersBeforeBoss: 18,
				gapBetweenSpawns: { min: 1.5, max: 3 },
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
				encountersBeforeBoss: 22,
				gapBetweenSpawns: { min: 1.25, max: 2.75 },
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
				encountersBeforeBoss: 25,
				gapBetweenSpawns: { min: 1.25, max: 2.5 },
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
				encountersBeforeBoss: 28,
				gapBetweenSpawns: { min: 1, max: 2.5 },
			},
		},
		{
			id: "fenda_vazio",
			name: "Void Rift",
			kind: "combat",
			position: { x: 0.88, y: 0.5 },
			connections: [{ id: "castelo", distance: 4 }],
			monsterPool: ["olho_do_vazio", "criatura_do_vazio"],
			level: 14,
			gatedBy: ["castelo"],
			encounterPlan: {
				encountersBeforeBoss: 30,
				gapBetweenSpawns: { min: 1, max: 2.25 },
			},
		},
	],
};
