export const ARRIVAL_RETRY_MS = 1000;

export type TravelSnapshot = {
	destination: string;
	startedAt: number | null;
	arrivesAt: number;
};

export type TravelWindow = { remainingMs: number; durationMs: number };

export function travelWindow(
	serverNow: number,
	startedAt: number | null,
	arrivesAt: number,
): TravelWindow {
	const remaining = Math.max(0, arrivesAt - serverNow);
	if (startedAt === null)
		return { remainingMs: remaining, durationMs: remaining };
	const duration = Math.max(0, arrivesAt - startedAt);
	return { remainingMs: Math.min(remaining, duration), durationMs: duration };
}
