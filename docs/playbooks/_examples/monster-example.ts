// Sentinel example for docs/playbooks/adding-a-monster.md — step 1.
// If this stops compiling, the playbook is out of date.
//
// Demonstrates: a normal-rarity monster entry with sprite + base stats
// (physicalDamage object, not min/max flats; elementalDamage array).

import type { MonsterDefinition } from "#/game/monsters/types";

export const PLAYBOOK_MONSTER_EXAMPLE: MonsterDefinition = {
	id: "stone_goblin_example",
	name: "Stone Goblin",
	sprite: "/assets/sprites/criaturas/goblin.png",
	baseStats: {
		hp: 18,
		attackSpeed: 0.9,
		physicalDamage: { min: 3, max: 6 },
		elementalDamage: [],
	},
	xpReward: 12,
	allowedRarities: ["normal", "magic"],
};
