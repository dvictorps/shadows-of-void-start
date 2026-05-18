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
			position: { x: 0.25, y: 0.5 },
			connections: ["forest"],
		},
		{
			id: "forest_starter",
			name: "Starter Forest",
			kind: "combat",
			position: { x: 0.65, y: 0.5 },
			connections: ["city"],
			monsterPool: ["goblin"],
			level: 1,
		},
	],
};
