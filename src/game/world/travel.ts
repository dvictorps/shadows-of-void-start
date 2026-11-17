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
