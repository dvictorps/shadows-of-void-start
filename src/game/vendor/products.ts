// Vendor catalog — the set of consumables the vendor sells. Per CONTEXT.md
// → Vendor: the vendor sells only consumables (no gear). For B2 (initial
// economy slice) the catalog ships with just the life potion. Teleport
// stones and wind crystals join the catalog in a later PR alongside their
// usage mechanics.

export type VendorProductId = "potion";

export interface VendorProduct {
	id: VendorProductId;
	priceRubys: number;
}

export const VENDOR_PRODUCTS: Record<VendorProductId, VendorProduct> = {
	potion: { id: "potion", priceRubys: 10 },
};

export function findVendorProduct(id: string): VendorProduct | null {
	return id in VENDOR_PRODUCTS
		? VENDOR_PRODUCTS[id as VendorProductId]
		: null;
}
