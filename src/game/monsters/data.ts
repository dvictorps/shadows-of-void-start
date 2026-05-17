import type { MonsterDefinition } from "./types";

export const MONSTERS = {
	goblin: {
		id: "goblin",
		name: "Goblin",
		emoji: "👹",
		baseStats: {
			hp: 10,
			attackSpeed: 1.2,
			minDamage: 8,
			maxDamage: 12,
		},
		xpReward: 5,
		allowedRarities: ["normal"],
	},
} as const satisfies Record<string, MonsterDefinition>;

export type MonsterId = keyof typeof MONSTERS;

function isMonsterId(id: string): id is MonsterId {
	return Object.hasOwn(MONSTERS, id);
}

/**
 * Safe lookup for a monster id that may have come from persisted data or a
 * zone's pool. Returns null when the id is unknown.
 */
export function findMonster(id: string): MonsterDefinition | null {
	return isMonsterId(id) ? MONSTERS[id] : null;
}
