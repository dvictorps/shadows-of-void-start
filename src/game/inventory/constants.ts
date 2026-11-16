export const INVENTORY_MAX_SLOTS = 60;
export const STASH_MAX_SLOTS = 60;

/**
 * Comparator for arrays of inventory items / docs, ordering by ascending
 * `inventorySlot`. Items without a slot sort to the end. Used in
 * every optimistic update that re-sorts the inventory query after a
 * placement.
 */
export function bySlotAsc<T extends { inventorySlot?: number | null }>(
	a: T,
	b: T,
): number {
	const sa = a.inventorySlot ?? Number.MAX_SAFE_INTEGER;
	const sb = b.inventorySlot ?? Number.MAX_SAFE_INTEGER;
	return sa - sb;
}

/**
 * Returns an allocator that hands out unoccupied inventory slots in ascending
 * order. Used by the server procedures and by the optimistic updates that
 * place freshly-picked or displaced items, so both pick the same slots.
 * Returns -1 when the inventory is full (caller's responsibility to handle).
 */
export function createInventorySlotAllocator(
	existing: ReadonlyArray<{ inventorySlot?: number | null }>,
): () => number {
	const occupied = new Set<number>();
	for (const it of existing) {
		if (it.inventorySlot != null) occupied.add(it.inventorySlot);
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

export function byStashSlotAsc<T extends { stashSlot?: number | null }>(
	a: T,
	b: T,
): number {
	const sa = a.stashSlot ?? Number.MAX_SAFE_INTEGER;
	const sb = b.stashSlot ?? Number.MAX_SAFE_INTEGER;
	return sa - sb;
}

export function createStashSlotAllocator(
	existing: ReadonlyArray<{ stashSlot?: number | null }>,
): () => number {
	const occupied = new Set<number>();
	for (const it of existing) {
		if (it.stashSlot != null) occupied.add(it.stashSlot);
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
