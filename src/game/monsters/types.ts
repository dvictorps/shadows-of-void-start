// ── Monster rarities ──
// Matches the item rarity vocabulary but mobs only use a subset.
// `rare` is reserved for minibosses.

export type MonsterRarity = "normal" | "magic" | "rare";

// ── Monster definition (template, lives in game data) ──

// Per-element damage component, mirrors the player's SwingProfile shape so
// the combat engine handles both sides through identical pipelines.
export interface MonsterElementDamage {
	element: "Cold" | "Fire" | "Lightning" | "Void";
	min: number;
	max: number;
}

export interface MonsterDefinition {
	id: string;
	name: string;
	sprite: string;
	baseStats: {
		hp: number;
		attackSpeed: number;
		// Defaults to {min: 0, max: 0} for monsters that only hit with elements.
		physicalDamage: { min: number; max: number };
		// Defaults to [] for monsters that only hit physical.
		elementalDamage: MonsterElementDamage[];
	};
	xpReward: number;
	// Rarities allowed when this template spawns. Used by the zone roller to
	// optionally tag the instance as magic/normal. Minibosses are handled
	// separately (always rare).
	allowedRarities: MonsterRarity[];
}
