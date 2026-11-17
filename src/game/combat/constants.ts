export const POTION_HEAL_FRACTION = 0.2;

export const COMBAT_PHASES = ["combat", "exploration", "camp"] as const;
export type CombatPhase = (typeof COMBAT_PHASES)[number];

export const RETENTION_CAP_FRACTION = 0.3;

export function computeBagKeepCap(bagSize: number, phase: CombatPhase): number {
	if (bagSize === 0) return 0;
	if (phase === "camp") return bagSize;
	return Math.max(1, Math.floor(bagSize * RETENTION_CAP_FRACTION));
}

export const BASE_CAST_SPEED = 1.0;

export const CRIT_CHANCE_FLOOR = 5;
export const CRIT_CHANCE_CAP = 100;
export const BASE_CRIT_MULTIPLIER = 50;

export const BARRIER_REFILL_DELAY_SECONDS = 10;

export const LEECH_RATE_PER_SECOND = 0.2;
export const LEECH_CAP_PCT_MAX_LIFE_PER_SECOND = 0.2;

export const ELEMENT_SWITCH_COOLDOWN_MS = 5_000;

export const MAX_POTIONS = 10;
export const POTION_DROP_CHANCE = 0.2;

export const POTION_REFILL_FLOOR = 3;

export const ETHEREAL_INCENSE_DROP_CHANCE = 0.025;

export const DUAL_WIELD_AS_MORE_MULT = 1.1;
export const DUAL_WIELD_BLOCK_CHANCE_BONUS = 10;

export const TELEPORT_STONE_TRAVEL_SECONDS_CITY = 1.5;
export const TELEPORT_STONE_TRAVEL_SECONDS_NON_CITY = 3;

export function teleportStoneTravelSeconds(destinationNodeId: string): number {
	return destinationNodeId === "city"
		? TELEPORT_STONE_TRAVEL_SECONDS_CITY
		: TELEPORT_STONE_TRAVEL_SECONDS_NON_CITY;
}
