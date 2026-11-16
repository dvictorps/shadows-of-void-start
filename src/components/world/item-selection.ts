// Selection rules for the item modals (the stash; the vendor uses `toggleId`).
// Pure, tested in item-selection.test.ts.

/** `selected` with `id` flipped. */
export function toggleId(
	selected: ReadonlySet<number>,
	id: number,
): Set<number> {
	const next = new Set(selected);
	if (next.has(id)) next.delete(id);
	else next.add(id);
	return next;
}

/** True when every one of `items` is selected (and there is at least one). */
export function allSelected(
	selected: ReadonlySet<number>,
	items: readonly { id: number }[],
): boolean {
	return items.length > 0 && selected.size === items.length;
}

/** Select-all as a toggle: everything, or nothing once everything is selected. */
export function toggleAll(
	selected: ReadonlySet<number>,
	items: readonly { id: number }[],
): Set<number> {
	return allSelected(selected, items)
		? new Set()
		: new Set(items.map((it) => it.id));
}
