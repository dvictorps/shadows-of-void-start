export const INVENTORY_MAX_SLOTS = 60;

/**
 * Comparator for arrays of inventory items / docs, ordering by ascending
 * `inventorySlot`. Items with an undefined slot sort to the end. Used in
 * every optimistic update that re-sorts the inventory query after a
 * placement.
 */
export function bySlotAsc<T extends { inventorySlot?: number }>(
	a: T,
	b: T,
): number {
	const sa = a.inventorySlot ?? Number.MAX_SAFE_INTEGER;
	const sb = b.inventorySlot ?? Number.MAX_SAFE_INTEGER;
	return sa - sb;
}
