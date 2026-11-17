export const MONSTER_RARITIES = ["normal", "magic", "rare", "unique"] as const;
export type MonsterRarity = (typeof MONSTER_RARITIES)[number];

export interface MonsterElementDamage {
	element: "Cold" | "Fire" | "Lightning" | "Void";
	min: number;
	max: number;
}

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
	pathColor: string;
	baseStats: {
		hp: number;
		attackSpeed: number;
		physicalDamage: { min: number; max: number };
		elementalDamage: MonsterElementDamage[];
		resistances?: Partial<MonsterResistances>;
	};
	xpReward: number;
	allowedRarities: MonsterRarity[];
}
