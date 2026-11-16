import type { VendorProduct } from "./products";

// Vendor purchase rules (CONTEXT.md → Vendor) for the `vendor.vendorBuy`
// procedure. Prices and caps come from the catalog, never from the client.

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
		return { ok: false, error: "Quantity must be a positive integer" };
	}
	const cost = product.priceRubys * quantity;
	if (params.rubys < cost) return { ok: false, error: "Not enough rubys" };
	const count = params.currentCount + quantity;
	if (product.cap !== undefined && count > product.cap) {
		return { ok: false, error: `${product.id} cap reached` };
	}
	return { ok: true, cost };
}
