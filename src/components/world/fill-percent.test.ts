import { describe, expect, it } from "vitest";

import { fillPercent } from "./fill-percent";

describe("fillPercent", () => {
	it("is current over max, in percent", () => {
		expect(fillPercent(25, 100)).toBe(25);
		expect(fillPercent(1, 3)).toBeCloseTo(33.333, 3);
	});

	it("clamps to 0–100", () => {
		expect(fillPercent(250, 100)).toBe(100);
		expect(fillPercent(-5, 100)).toBe(0);
	});

	it("is 0 without a max", () => {
		expect(fillPercent(10, 0)).toBe(0);
		expect(fillPercent(0, 0)).toBe(0);
	});
});
