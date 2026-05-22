// Vendor catalog — the set of consumables the vendor sells. Per CONTEXT.md
// → Vendor: the vendor sells only consumables (no gear). For B2 (initial
// economy slice) the catalog ships with just the life potion. Teleport
// stones and wind crystals join the catalog in a later PR alongside their
// usage mechanics.

import { MAX_POTIONS } from "../combat/constants";

export type VendorProductId = "potion" | "teleport_stone";

// The character document field that holds the count of this product.
// Used by `vendorBuy` (cap + increment) and `VendorModal` (disable button at
// cap). Narrowed to the union of counter field names so callers get type
// safety on `char[product.counterField]`. The legacy `windCrystals` field
// stays on the schema for stored data but is no longer a vendor counter.
export type VendorCounterField = "potions" | "teleportStones";

export interface VendorProduct {
	id: VendorProductId;
	priceRubys: number;
	emoji: string;
	// Public path to the product's sprite. When undefined, VendorModal falls
	// back to the emoji.
	icon?: string;
	counterField: VendorCounterField;
	// Carry cap. Undefined = uncapped (player can stockpile arbitrarily many).
	// Potions are capped at 10 because they're the active heal control with
	// combat consequences; travel consumables aren't gameplay-balanced by
	// supply, only by ruby cost.
	cap?: number;
}

export const VENDOR_PRODUCTS: Record<VendorProductId, VendorProduct> = {
	potion: {
		id: "potion",
		priceRubys: 10,
		emoji: "🧪",
		icon: "/assets/sprites/ui/pocaoCura.png",
		counterField: "potions",
		cap: MAX_POTIONS,
	},
	teleport_stone: {
		id: "teleport_stone",
		// Repriced 30 → 40 with the wind-crystal consolidation: stone now
		// carries the wind crystal's "jump to any unlocked node" role too,
		// so it's worth more per unit.
		priceRubys: 40,
		emoji: "🪨",
		icon: "/assets/sprites/ui/pedraTeleporte.png",
		counterField: "teleportStones",
	},
};

export function findVendorProduct(id: string): VendorProduct | null {
	return id in VENDOR_PRODUCTS ? VENDOR_PRODUCTS[id as VendorProductId] : null;
}
