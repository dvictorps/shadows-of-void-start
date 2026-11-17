import { SERVER_ERRORS } from "#/lib/server-errors";

import type { VendorProduct } from "./products";

export type PurchaseDecision =
	| { ok: false; error: string }
	| { ok: true; cost: number };

export function resolvePurchase(params: {
	product: VendorProduct;
	quantity: number;
	rubys: number;
	currentCount: number;
}): PurchaseDecision {
	const { product, quantity } = params;
	if (!Number.isInteger(quantity) || quantity <= 0) {
		return { ok: false, error: SERVER_ERRORS.invalidQuantity };
	}
	const cost = product.priceRubys * quantity;
	if (params.rubys < cost) {
		return { ok: false, error: SERVER_ERRORS.notEnoughRubys };
	}
	const count = params.currentCount + quantity;
	if (product.cap !== undefined && count > product.cap) {
		return { ok: false, error: `${product.id} cap reached` };
	}
	return { ok: true, cost };
}
