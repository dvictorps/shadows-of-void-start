// Travel time between connected world nodes.
//
// Formula: `time = max(MIN_TRAVEL_SECONDS, distance / (1 + 2 * ms / 100))`.
//
// - `distance` is the abstract unit on `NodeConnection.distance` (see
//   `src/game/world/types.ts`). One unit ≈ one second of base travel.
// - `ms` is the player's accumulated movement speed % from boots / gear.
//   The 2× coefficient is intentional — CONTEXT.md describes the effect as
//   "drastically reduces" travel time, and the standard PoE 1× scaling
//   barely registers (25% MS = 25% faster; players don't feel it).
// - The floor keeps travel visible even at extreme MS so the player always
//   gets feedback from the progress bar.

export const MIN_TRAVEL_SECONDS = 0.5;
export const MS_TRAVEL_COEFFICIENT = 2;

export function computeTravelTime(
	distance: number,
	movementSpeedPct: number,
): number {
	const ms = Math.max(0, movementSpeedPct);
	const baseSeconds = Math.max(0, distance);
	const denominator = 1 + (MS_TRAVEL_COEFFICIENT * ms) / 100;
	const scaled = baseSeconds / Math.max(0.01, denominator);
	return Math.max(MIN_TRAVEL_SECONDS, Math.min(scaled, 30));
}
