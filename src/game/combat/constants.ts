// Fraction of max HP restored by a potion. Shared by client (optimistic heal
// in useCombatLoop) and server (authoritative consumePotion) so balance
// changes can't drift between the two.
export const POTION_HEAL_FRACTION = 0.2;

// Combat phase exposed to consumers — drives bag-retention cap on exit
// (camp = 100%, exploration/combat = 30%). See CONTEXT.md → Bag
// retention tiers. The server derives phase from `char.inCamp` rather
// than trusting a client-supplied value (see convex/items.ts).
export const COMBAT_PHASES = ["combat", "exploration", "camp"] as const;
export type CombatPhase = (typeof COMBAT_PHASES)[number];

// Bag retention: non-camp exits cap kept items at this fraction of bag
// size (floor, min 1 when ≥1 item, 0 when empty). Camp keeps everything.
// Server (convex/items.ts:exitZone) enforces it authoritatively; client
// (world.tsx) mirrors for UX. Both call `computeBagKeepCap` so a rebalance
// here can't desync them.
export const RETENTION_CAP_FRACTION = 0.3;

export function computeBagKeepCap(bagSize: number, phase: CombatPhase): number {
	if (bagSize === 0) return 0;
	if (phase === "camp") return bagSize;
	return Math.max(1, Math.floor(bagSize * RETENTION_CAP_FRACTION));
}

// Caster weapons have no per-template cast speed — every wand/staff casts at
// this baseline and global cast-speed mods scale it.
export const BASE_CAST_SPEED = 1.0;

// Barrier regen: while barrier is above zero, it ticks back at this fraction
// of max barrier per second (5% → 20s to fully refill from empty). The rate
// is fixed; no per-second cap on the absolute regen because heavy barrier
// investment is intentionally rewarded with proportionally larger raw regen
// (asymmetric to leech's 20%-max-life cap by design — see ADR 0005).
export const BARRIER_REGEN_FRACTION_PER_SECOND = 0.05;

// Barrier cooldown: when current barrier hits zero from damage, this many
// seconds elapse before regen resumes. During the cooldown, regen is paused
// and incoming damage hits life directly. The cooldown is not reset or
// extended by further hits. After it expires, regen ticks from zero at the
// standard rate — there is no instant-refill (see ADR 0005).
export const BARRIER_COOLDOWN_SECONDS = 10;

// Leech: how much of the magnitude ticks per second (so duration = 1/rate s).
export const LEECH_RATE_PER_SECOND = 0.2;
// Leech regen capped at this fraction of maxLife per second across all stacks.
export const LEECH_CAP_PCT_MAX_LIFE_PER_SECOND = 0.2;

// Potions: hard cap on carried potions, and the per-kill drop chance.
// Drops above the cap are silently wasted (see CONTEXT.md → Potion drops).
export const MAX_POTIONS = 10;
export const POTION_DROP_CHANCE = 0.2;

// Safety refill — when the player reaches a safe state (city arrival,
// teleport-stone-to-city, respawn) the potion count is bumped up to at
// least this many. Drops above it stay; drops below it are topped up.
// Keeps a fresh run viable even after a wipe.
export const POTION_REFILL_FLOOR = 3;

// Incenso Etéreo — independent per-kill drop roll (like POTION_DROP_CHANCE).
// Lives on character.etherealIncense, uncapped supply. Triggers the camp
// cinematic on demand. See CONTEXT.md → Active player input → Incenso Etéreo.
export const ETHEREAL_INCENSE_DROP_CHANCE = 0.025;

// Attack dual-wielding implicit buffs (attack-1H + attack-1H only — wand+wand
// is excluded). The AS buff is a "more" multiplier applied after the increased
// pool, on top of the averaged base attack speed. The block bonus is additive
// into the character's blockChance total (still bound by the 75% cap).
export const DUAL_WIELD_AS_MORE_MULT = 1.1;
export const DUAL_WIELD_BLOCK_CHANCE_BONUS = 10;

// Teleport Stone — the single travel consumable (the wind crystal was
// consolidated into this in feat/stone-consolidation). Stone takes the
// player to any previously-visited node (entries in `unlockedNodes`).
// Two travel times depending on destination: a short hop home, and the
// standard skip-zones duration for elsewhere. Neither uses movement-speed
// scaling — you're skipping geography, not walking it. Uncapped supply,
// price-gated only.
export const TELEPORT_STONE_TRAVEL_SECONDS_CITY = 1.5;
export const TELEPORT_STONE_TRAVEL_SECONDS_NON_CITY = 3;

// Server (`convex/combat.ts:useTeleportStone`) and client (optimistic update
// in `world.tsx`) both compute travel duration from the destination — keep
// them in lockstep via this helper.
export function teleportStoneTravelSeconds(destinationNodeId: string): number {
	return destinationNodeId === "city"
		? TELEPORT_STONE_TRAVEL_SECONDS_CITY
		: TELEPORT_STONE_TRAVEL_SECONDS_NON_CITY;
}
