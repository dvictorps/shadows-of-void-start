// ── Monster rarities ──
// Matches the item rarity vocabulary but mobs only use a subset.
// `rare` is reserved for minibosses.

export type MonsterRarity = "normal" | "magic" | "rare";

// ── Monster definition (template, lives in game data) ──

export interface MonsterDefinition {
	id: string;
	name: string;
	emoji: string;
	baseStats: {
		hp: number;
		attackSpeed: number;
		minDamage: number;
		maxDamage: number;
	};
	xpReward: number;
	// Rarities allowed when this template spawns. Used by the zone roller to
	// optionally tag the instance as magic/normal. Minibosses are handled
	// separately (always rare).
	allowedRarities: MonsterRarity[];
}
