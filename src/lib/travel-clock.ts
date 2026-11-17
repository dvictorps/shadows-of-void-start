export const ARRIVAL_RETRY_MS = 1000;

export type TravelSnapshot = {
	destination: string;
	startedAt: number | null;
	arrivesAt: number;
};

export function localTravelEnd(
	now: number,
	startedAt: number | null,
	arrivesAt: number,
): number {
	const remaining = Math.max(0, arrivesAt - now);
	if (startedAt === null) return now + remaining;
	const duration = Math.max(0, arrivesAt - startedAt);
	return now + Math.min(remaining, duration);
}
