import type { VendorProduct } from "#/game/vendor/products";

export const STEPPER_MAX = 99;

export type BuyLimits = {
	maxQty: number;
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

export function clampQty(qty: number, maxQty: number): number {
	return maxQty <= 0 ? 1 : Math.min(qty, maxQty);
}
