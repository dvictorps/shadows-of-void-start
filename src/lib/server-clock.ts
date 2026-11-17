import { useSyncExternalStore } from "react";

export const CLOCK_SAMPLES_PER_SYNC = 3;
export const CLOCK_JITTER_MS = 250;
export const GOOD_ROUND_TRIP_MS = 150;
export const CLOCK_RESYNC_MS = 5 * 60_000;

export type ClockSample = { offsetMs: number; roundTripMs: number };

export function clockSample(
	sentAt: number,
	serverAt: number,
	receivedAt: number,
): ClockSample {
	return {
		offsetMs: Math.round(serverAt - (sentAt + receivedAt) / 2),
		roundTripMs: receivedAt - sentAt,
	};
}

export function bestSample(
	samples: readonly ClockSample[],
): ClockSample | null {
	let best: ClockSample | null = null;
	for (const sample of samples) {
		if (best === null || sample.roundTripMs < best.roundTripMs) best = sample;
	}
	return best;
}

let offsetMs = 0;
const listeners = new Set<() => void>();

export function serverNow(): number {
	return Date.now() + offsetMs;
}

export function serverClockOffset(): number {
	return offsetMs;
}

export function setServerClockOffset(next: number): void {
	if (Math.abs(next - offsetMs) < CLOCK_JITTER_MS) return;
	offsetMs = next;
	for (const listener of listeners) listener();
}

export function subscribeServerClock(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function useServerClockOffset(): number {
	return useSyncExternalStore(subscribeServerClock, serverClockOffset, () => 0);
}

let inflight: Promise<void> | null = null;
let lastSyncAt = Number.NEGATIVE_INFINITY;

export function resetServerClock(): void {
	offsetMs = 0;
	inflight = null;
	lastSyncAt = Number.NEGATIVE_INFINITY;
}

export function syncServerClock(
	fetchServerTime: () => Promise<number>,
	{ minIntervalMs = 0 }: { minIntervalMs?: number } = {},
): Promise<void> {
	if (inflight) return inflight;
	if (Date.now() - lastSyncAt < minIntervalMs) return Promise.resolve();
	inflight = takeSamples(fetchServerTime).finally(() => {
		inflight = null;
		lastSyncAt = Date.now();
	});
	return inflight;
}

async function takeSamples(
	fetchServerTime: () => Promise<number>,
): Promise<void> {
	const taken: ClockSample[] = [];
	try {
		for (let i = 0; i < CLOCK_SAMPLES_PER_SYNC; i++) {
			const sentAt = Date.now();
			const serverAt = await fetchServerTime();
			const sample = clockSample(sentAt, serverAt, Date.now());
			taken.push(sample);
			if (sample.roundTripMs <= GOOD_ROUND_TRIP_MS) break;
		}
	} catch {
		if (taken.length === 0) return;
	}
	const best = bestSample(taken);
	if (best) setServerClockOffset(best.offsetMs);
}
