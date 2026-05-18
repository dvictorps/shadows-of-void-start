import { describe, expect, it } from "vitest";
import { computeTravelTime, MIN_TRAVEL_SECONDS } from "./travel";

describe("computeTravelTime", () => {
	it("returns distance verbatim when movement speed is zero", () => {
		expect(computeTravelTime(5, 0)).toBe(5);
		expect(computeTravelTime(3, 0)).toBe(3);
	});

	it("applies the 2x movement-speed coefficient", () => {
		// 25% MS → 1 / (1 + 0.5) = 0.667x → 5 * 0.667 ≈ 3.33
		expect(computeTravelTime(5, 25)).toBeCloseTo(3.333, 2);
		// 50% MS → 1 / 2 = 0.5x → 5 * 0.5 = 2.5
		expect(computeTravelTime(5, 50)).toBeCloseTo(2.5, 2);
	});

	it("floors at MIN_TRAVEL_SECONDS even with extreme MS", () => {
		expect(computeTravelTime(3, 10000)).toBe(MIN_TRAVEL_SECONDS);
		expect(computeTravelTime(0, 0)).toBe(MIN_TRAVEL_SECONDS);
	});

	it("clamps negative inputs", () => {
		expect(computeTravelTime(-5, 0)).toBe(MIN_TRAVEL_SECONDS);
		expect(computeTravelTime(5, -50)).toBe(5);
	});
});
