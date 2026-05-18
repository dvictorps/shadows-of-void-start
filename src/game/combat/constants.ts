// Fraction of max HP restored by a potion. Shared by client (optimistic heal
// in useCombatLoop) and server (authoritative consumePotion) so balance
// changes can't drift between the two.
export const POTION_HEAL_FRACTION = 0.2;

// Caster weapons have no per-template cast speed — every wand/staff casts at
// this baseline and global cast-speed mods scale it.
export const BASE_CAST_SPEED = 1.0;

// Barrier recovery: after barrier reaches zero, this many seconds elapse
// before it refills to 100% in a single tick. The timer does not reset on
// damage during the window.
export const BARRIER_RECOVERY_SECONDS = 6;

// Leech: how much of the magnitude ticks per second (so duration = 1/rate s).
export const LEECH_RATE_PER_SECOND = 0.2;
// Leech regen capped at this fraction of maxLife per second across all stacks.
export const LEECH_CAP_PCT_MAX_LIFE_PER_SECOND = 0.2;

// Potions: hard cap on carried potions, and the per-kill drop chance.
// Drops above the cap are silently wasted (see CONTEXT.md → Potion drops).
export const MAX_POTIONS = 10;
export const POTION_DROP_CHANCE = 0.2;

// Travel consumables — vendor-only (no drops). Teleport stones instantly
// return the player to the city; wind crystals jump to any previously-
// unlocked node with a fixed travel duration (no MS scaling — you're
// skipping zones, not walking them). Neither has a carry cap: the player
// can stockpile arbitrarily many, limited only by ruby income.
export const WIND_CRYSTAL_TRAVEL_SECONDS = 3;
