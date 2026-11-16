// How many of a product the player may buy right now. Pure, tested in
// buy-limits.test.ts; the server enforces the same cap and balance.

import type { VendorProduct } from "#/game/vendor/products";

/** The stepper's ceiling when neither the cap nor the balance binds. */
export const STEPPER_MAX = 99;

export type BuyLimits = {
	/** The largest quantity the stepper allows (0 when nothing can be bought). */
	maxQty: number;
	/** The player already holds the product's cap. */
	atCap: boolean;
};

export function buyLimits(
	product: Pick<VendorProduct, "priceRubys" | "cap">,
	rubys: number,
	currentCount: number,
): BuyLimits {
	const capRemaining =
		product.cap === undefined
			? STEPPER_MAX
			: Math.max(0, product.cap - currentCount);
	const maxAfford =
		product.priceRubys > 0
			? Math.floor(rubys / product.priceRubys)
			: STEPPER_MAX;
	return {
		maxQty: Math.min(STEPPER_MAX, capRemaining, maxAfford),
		atCap: capRemaining === 0,
	};
}

/** `qty` pulled into the stepper's range; 1 when nothing can be bought. */
export function clampQty(qty: number, maxQty: number): number {
	return maxQty <= 0 ? 1 : Math.min(qty, maxQty);
}
