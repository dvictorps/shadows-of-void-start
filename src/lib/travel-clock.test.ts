import { describe, expect, it } from "vitest";

import { travelWindow } from "./travel-clock";

const NOW = 1_000_000;

describe("travelWindow", () => {
	it("keeps the server's remaining time and the trip's length", () => {
		expect(travelWindow(NOW, NOW - 1000, NOW + 2000)).toEqual({
			remainingMs: 2000,
			durationMs: 3000,
		});
	});

	it("never waits longer than the trip, however far behind the clock runs", () => {
		const serverStart = NOW + 9000;
		expect(travelWindow(NOW, serverStart, serverStart + 3000)).toEqual({
			remainingMs: 3000,
			durationMs: 3000,
		});
	});

	it("ends at once when the clock runs past the arrival", () => {
		expect(travelWindow(NOW, NOW - 12_000, NOW - 9000).remainingMs).toBe(0);
	});

	it("treats the remaining time as the whole trip when the start is unknown", () => {
		expect(travelWindow(NOW, null, NOW + 4000)).toEqual({
			remainingMs: 4000,
			durationMs: 4000,
		});
	});
});
