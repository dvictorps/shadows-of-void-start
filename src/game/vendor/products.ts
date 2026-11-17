import { MAX_POTIONS } from "../combat/constants";
import { hasOwnKey } from "../typed-object";

export type VendorProductId = "potion" | "teleport_stone";

export type VendorCounterField = "potions" | "teleportStones";

export interface VendorProduct {
	id: VendorProductId;
	priceRubys: number;
	emoji: string;
	icon?: string;
	counterField: VendorCounterField;
	cap?: number;
}

const POTION: VendorProduct = {
	id: "potion",
	priceRubys: 10,
	emoji: "🧪",
	icon: "/assets/sprites/ui/pocaoCura.png",
	counterField: "potions",
	cap: MAX_POTIONS,
};

const TELEPORT_STONE: VendorProduct = {
	id: "teleport_stone",
	priceRubys: 40,
	emoji: "🪨",
	icon: "/assets/sprites/ui/pedraTeleporte.png",
	counterField: "teleportStones",
};

export const VENDOR_PRODUCTS = {
	potion: POTION,
	teleport_stone: TELEPORT_STONE,
} satisfies Record<VendorProductId, VendorProduct>;

export function findVendorProduct(id: string): VendorProduct | null {
	return hasOwnKey(VENDOR_PRODUCTS, id) ? VENDOR_PRODUCTS[id] : null;
}
