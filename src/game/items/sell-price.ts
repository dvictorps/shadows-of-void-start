import type { GeneratedItem, ItemRarity } from "./types";

// Sell price formula — per CONTEXT.md → "Vendor price formula":
//
//     price = base_rarity × (1 + ilvl / 10) × (1 + mod_quality_total / 10)
//
// `mod_quality_total` sums (11 - tier_index) across all explicit mods.
// T1 (best) contributes 10; T10 (worst) contributes 1. Normal items have
// no explicit mods → mod_quality_total = 0 → factor = 1.

const BASE_RARITY_PRICE: Record<ItemRarity, number> = {
	normal: 5,
	magic: 20,
	rare: 80,
	legendary: 400,
	epic: 2000,
};

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
