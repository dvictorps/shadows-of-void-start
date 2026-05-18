// Vendor catalog — the set of consumables the vendor sells. Per CONTEXT.md
// → Vendor: the vendor sells only consumables (no gear). For B2 (initial
// economy slice) the catalog ships with just the life potion. Teleport
// stones and wind crystals join the catalog in a later PR alongside their
// usage mechanics.

export type VendorProductId = "potion" | "teleport_stone" | "wind_crystal";

export interface VendorProduct {
	id: VendorProductId;
	priceRubys: number;
	// Display metadata co-located here so the UI can iterate the catalog
	// without a parallel switch statement. Localised label comes from
	// paraglide via the id (see VendorModal#productLabel).
	emoji: string;
}

export const VENDOR_PRODUCTS: Record<VendorProductId, VendorProduct> = {
	potion: { id: "potion", priceRubys: 10, emoji: "🧪" },
	teleport_stone: { id: "teleport_stone", priceRubys: 30, emoji: "🪨" },
	wind_crystal: { id: "wind_crystal", priceRubys: 50, emoji: "💎" },
};

export function findVendorProduct(id: string): VendorProduct | null {
	return id in VENDOR_PRODUCTS
		? VENDOR_PRODUCTS[id as VendorProductId]
		: null;
}
