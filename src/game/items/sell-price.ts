import type { GeneratedItem, ItemRarity } from "./types";

const BASE_RARITY_PRICE = {
	normal: 5,
	magic: 20,
	rare: 80,
	legendary: 400,
	epic: 2000,
	unique: 200,
} satisfies Record<ItemRarity, number>;

export function computeSellPrice(item: GeneratedItem): number {
	const base = BASE_RARITY_PRICE[item.rarity];
	const ilvlFactor = 1 + item.itemLevel / 10;
	const modQuality = item.explicits.reduce(
		(sum, mod) => sum + (11 - mod.tier),
		0,
	);
	const modFactor = 1 + modQuality / 10;
	return Math.max(1, Math.floor(base * ilvlFactor * modFactor));
}
