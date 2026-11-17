import { describe, expect, it } from "vitest";

import { localTravelEnd } from "./travel-clock";

const NOW = 1_000_000;

describe("localTravelEnd", () => {
	it("keeps the server's remaining time when the clocks agree", () => {
		expect(localTravelEnd(NOW, NOW - 1000, NOW + 2000)).toBe(NOW + 2000);
	});

	it("never waits longer than the trip, however far behind the local clock runs", () => {
		const serverNow = NOW + 9000;
		expect(localTravelEnd(NOW, serverNow, serverNow + 3000)).toBe(NOW + 3000);
	});

	it("ends at once when the local clock runs past the arrival", () => {
		expect(localTravelEnd(NOW, NOW - 12_000, NOW - 9000)).toBe(NOW);
	});

	it("falls back to the arrival alone when the start is unknown", () => {
		expect(localTravelEnd(NOW, null, NOW + 4000)).toBe(NOW + 4000);
	});
});
