import type { Act } from "./types";

export const ACT_1: Act = {
	id: "act-1",
	name: "Act 1",
	nodes: [
		{
			id: "city",
			name: "Cidade",
			kind: "city",
			position: { x: 0.25, y: 0.5 },
			connections: ["forest"],
		},
		{
			id: "forest",
			name: "Floresta Inicial",
			kind: "combat",
			position: { x: 0.65, y: 0.5 },
			connections: ["city"],
			monsterPool: ["goblin"],
		},
	],
};
