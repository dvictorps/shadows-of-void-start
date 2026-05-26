export const INVENTORY_MAX_SLOTS = 60;
export const STASH_MAX_SLOTS = 60;

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

/**
 * Returns an allocator that hands out unoccupied inventory slots in ascending
 * order. Used by optimistic updates that need to place freshly-picked or
 * displaced docs without colliding with existing ones. Returns -1 when the
 * inventory is full (caller's responsibility to handle).
 */
export function createInventorySlotAllocator(
	existing: ReadonlyArray<{ inventorySlot?: number }>,
): () => number {
	const occupied = new Set<number>();
	for (const it of existing) {
		if (typeof it.inventorySlot === "number") occupied.add(it.inventorySlot);
	}
	let cursor = 0;
	return () => {
		while (cursor < INVENTORY_MAX_SLOTS && occupied.has(cursor)) cursor++;
		if (cursor >= INVENTORY_MAX_SLOTS) return -1;
		const slot = cursor++;
		occupied.add(slot);
		return slot;
	};
}

export function byStashSlotAsc<T extends { stashSlot?: number }>(
	a: T,
	b: T,
): number {
	const sa = a.stashSlot ?? Number.MAX_SAFE_INTEGER;
	const sb = b.stashSlot ?? Number.MAX_SAFE_INTEGER;
	return sa - sb;
}

export function createStashSlotAllocator(
	existing: ReadonlyArray<{ stashSlot?: number }>,
): () => number {
	const occupied = new Set<number>();
	for (const it of existing) {
		if (typeof it.stashSlot === "number") occupied.add(it.stashSlot);
	}
	let cursor = 0;
	return () => {
		while (cursor < STASH_MAX_SLOTS && occupied.has(cursor)) cursor++;
		if (cursor >= STASH_MAX_SLOTS) return -1;
		const slot = cursor++;
		occupied.add(slot);
		return slot;
	};
}
