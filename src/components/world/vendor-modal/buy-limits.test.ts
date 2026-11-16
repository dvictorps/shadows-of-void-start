import { describe, expect, it } from "vitest";

import { buyLimits, clampQty, STEPPER_MAX } from "./buy-limits";

const POTION = { priceRubys: 10, cap: 10 };
const STONE = { priceRubys: 40 };

describe("buyLimits", () => {
	it("is bound by the balance", () => {
		expect(buyLimits(STONE, 85, 0)).toEqual({ maxQty: 2, atCap: false });
		expect(buyLimits(STONE, 39, 0)).toEqual({ maxQty: 0, atCap: false });
	});

	it("is bound by what the cap leaves", () => {
		expect(buyLimits(POTION, 1000, 8)).toEqual({ maxQty: 2, atCap: false });
		expect(buyLimits(POTION, 1000, 10)).toEqual({ maxQty: 0, atCap: true });
		expect(buyLimits(POTION, 1000, 12).atCap).toBe(true);
	});

	it("tops out at the stepper's ceiling", () => {
		expect(buyLimits(STONE, 1_000_000, 0).maxQty).toBe(STEPPER_MAX);
		expect(buyLimits({ priceRubys: 0 }, 0, 0).maxQty).toBe(STEPPER_MAX);
	});
});

describe("clampQty", () => {
	it("keeps a quantity in range and pulls a larger one down", () => {
		expect(clampQty(3, 5)).toBe(3);
		expect(clampQty(7, 5)).toBe(5);
	});

	it("rests at 1 when nothing can be bought", () => {
		expect(clampQty(4, 0)).toBe(1);
	});
});
