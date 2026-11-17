import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	bestSample,
	clockSample,
	CLOCK_RESYNC_MS,
	resetServerClock,
	serverClockOffset,
	serverNow,
	setServerClockOffset,
	subscribeServerClock,
	syncServerClock,
} from "./server-clock";

const NOW = 1_800_000_000_000;

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(NOW);
	resetServerClock();
});
afterEach(() => {
	resetServerClock();
	vi.useRealTimers();
});

describe("clockSample", () => {
	it("reads the offset at the midpoint of the round trip", () => {
		expect(clockSample(NOW, NOW + 12_100, NOW + 200)).toEqual({
			offsetMs: 12_000,
			roundTripMs: 200,
		});
	});
});

describe("bestSample", () => {
	it("keeps the sample with the shortest round trip", () => {
		const fast = { offsetMs: 5000, roundTripMs: 40 };
		const slow = { offsetMs: 5600, roundTripMs: 900 };
		expect(bestSample([slow, fast])).toBe(fast);
		expect(bestSample([])).toBeNull();
	});
});

describe("syncServerClock", () => {
	function serverAhead(offsetMs: number, roundTripsMs: number[]) {
		let call = 0;
		return () => {
			const trip = roundTripsMs[call++] ?? 0;
			vi.setSystemTime(Date.now() + trip / 2);
			const serverAt = Date.now() + offsetMs;
			vi.setSystemTime(Date.now() + trip / 2);
			return Promise.resolve(serverAt);
		};
	}

	it("moves serverNow onto the server's clock from the shortest round trip", async () => {
		await syncServerClock(serverAhead(-12_000, [300, 200, 500]));
		expect(serverClockOffset()).toBe(-12_000);
		expect(serverNow()).toBe(Date.now() - 12_000);
	});

	it("stops sampling once a round trip is short enough", async () => {
		const fetch = vi.fn<() => Promise<number>>(serverAhead(7000, [40, 40, 40]));
		await syncServerClock(fetch);
		expect(fetch).toHaveBeenCalledOnce();
		expect(serverClockOffset()).toBe(7000);
	});

	it("shares a sync already running and skips one inside the resync interval", async () => {
		const fetch = vi.fn<() => Promise<number>>(serverAhead(7000, [40, 40]));
		await Promise.all([syncServerClock(fetch), syncServerClock(fetch)]);
		expect(fetch).toHaveBeenCalledOnce();
		await syncServerClock(fetch, { minIntervalMs: CLOCK_RESYNC_MS });
		expect(fetch).toHaveBeenCalledOnce();
		vi.setSystemTime(Date.now() + CLOCK_RESYNC_MS);
		await syncServerClock(fetch, { minIntervalMs: CLOCK_RESYNC_MS });
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it("keeps the samples taken before a failed call", async () => {
		let call = 0;
		const ahead = serverAhead(9000, [400]);
		await syncServerClock(() =>
			call++ === 0 ? ahead() : Promise.reject(new Error("offline")),
		);
		expect(serverClockOffset()).toBe(9000);
	});

	it("keeps the old offset when no sample arrives", async () => {
		setServerClockOffset(4000);
		await syncServerClock(() => Promise.reject(new Error("offline")));
		expect(serverClockOffset()).toBe(4000);
	});
});

describe("setServerClockOffset", () => {
	it("notifies subscribers only past the jitter band", () => {
		const listener = vi.fn<() => void>();
		const unsubscribe = subscribeServerClock(listener);
		setServerClockOffset(100);
		expect(listener).not.toHaveBeenCalled();
		expect(serverClockOffset()).toBe(0);
		setServerClockOffset(3000);
		expect(listener).toHaveBeenCalledOnce();
		unsubscribe();
		setServerClockOffset(-3000);
		expect(listener).toHaveBeenCalledOnce();
	});
});
