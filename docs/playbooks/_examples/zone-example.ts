// Sentinel example for docs/playbooks/adding-a-zone.md — step 1.
// If this stops compiling, the playbook is out of date.
//
// Demonstrates: a combat node with connections (NodeConnection objects,
// not bare id strings), monster pool, level, and an encounterPlan.

import type { WorldNode } from "#/game/world/types";

export const PLAYBOOK_ZONE_EXAMPLE: WorldNode = {
	id: "shadow_glade_example",
	name: "Shadow Glade",
	kind: "combat",
	position: { x: 0.45, y: 0.6 },
	connections: [
		{ id: "forest_starter", distance: 3 },
		{ id: "forest_profunda", distance: 4 },
	],
	monsterPool: ["goblin", "serpente"],
	level: 4,
	gatedBy: ["forest_starter"],
	encounterPlan: {
		calmariaBudgetSeconds: 40,
		gapBetweenSpawns: { min: 1.5, max: 3 },
		campFractions: [0.5],
		ambushes: {
			fractions: [0.72],
			packSize: { min: 3, max: 4 },
			gapWithinPackMs: 800,
			magicChance: 0.5,
		},
	},
};
