// Vendor catalog — the set of consumables the vendor sells. Per CONTEXT.md
// → Vendor: the vendor sells only consumables (no gear). For B2 (initial
// economy slice) the catalog ships with just the life potion. Teleport
// stones and wind crystals join the catalog in a later PR alongside their
// usage mechanics.

import {
	MAX_POTIONS,
	MAX_TELEPORT_STONES,
	MAX_WIND_CRYSTALS,
} from "../combat/constants";

export type VendorProductId = "potion" | "teleport_stone" | "wind_crystal";

// The character document field that holds the count of this product.
// Used by `vendorBuy` (cap + increment) and `VendorModal` (disable button at
// cap). Narrowed to the union of the three counter field names so callers
// get type safety on `char[product.counterField]`.
export type VendorCounterField =
	| "potions"
	| "teleportStones"
	| "windCrystals";

export interface VendorProduct {
	id: VendorProductId;
	priceRubys: number;
	emoji: string;
	counterField: VendorCounterField;
	cap: number;
}

export const VENDOR_PRODUCTS: Record<VendorProductId, VendorProduct> = {
	potion: {
		id: "potion",
		priceRubys: 10,
		emoji: "🧪",
		counterField: "potions",
		cap: MAX_POTIONS,
	},
	teleport_stone: {
		id: "teleport_stone",
		priceRubys: 30,
		emoji: "🪨",
		counterField: "teleportStones",
		cap: MAX_TELEPORT_STONES,
	},
	wind_crystal: {
		id: "wind_crystal",
		priceRubys: 50,
		emoji: "💎",
		counterField: "windCrystals",
		cap: MAX_WIND_CRYSTALS,
	},
};

export function findVendorProduct(id: string): VendorProduct | null {
	return id in VENDOR_PRODUCTS
		? VENDOR_PRODUCTS[id as VendorProductId]
		: null;
}
