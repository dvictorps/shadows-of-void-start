import { describe, expect, it } from "vitest";

import { fitScale } from "./useFitScale";

describe("fitScale", () => {
	it("shrinks the content to the space it has", () => {
		expect(fitScale(277, 554)).toBe(0.5);
	});

	it("never grows it past its natural size", () => {
		expect(fitScale(900, 554)).toBe(1);
	});

	it("leaves it alone before the box is measured", () => {
		expect(fitScale(0, 554)).toBe(1);
	});
});
