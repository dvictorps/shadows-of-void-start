// ── Monster rarities ──
// Matches the item rarity vocabulary but mobs only use a subset.
// `rare` is reserved for minibosses. `unique` is reserved for act bosses —
// handcrafted single-identity enemies (PoE convention). See CONTEXT.md → Boss.

export type MonsterRarity = "normal" | "magic" | "rare" | "unique";

// ── Monster definition (template, lives in game data) ──

// Per-element damage component, mirrors the player's SwingProfile shape so
// the combat engine handles both sides through identical pipelines.
export interface MonsterElementDamage {
	element: "Cold" | "Fire" | "Lightning" | "Void";
	min: number;
	max: number;
}

// Resistance defaults — every regular mob ships with zeros. Bosses and other
// handcrafted enemies override per-element via `baseStats.resistances`.
// Negative values express vulnerability (boss-only convention; see
// CONTEXT.md → Boss).
export interface MonsterResistances {
	cold: number;
	fire: number;
	lightning: number;
	void: number;
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
		// Optional per-element resistance overrides. Omitted = all zeros.
		// Bosses use this to declare fire/cold/etc baselines (including
		// negative values for vulnerability). Mob mods can still stack on top.
		resistances?: Partial<MonsterResistances>;
	};
	xpReward: number;
	// Rarities allowed when this template spawns. Used by the zone roller to
	// optionally tag the instance as magic/normal. Minibosses are handled
	// separately (always rare).
	allowedRarities: MonsterRarity[];
}
