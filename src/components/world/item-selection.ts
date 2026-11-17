export function toggleId(
	selected: ReadonlySet<number>,
	id: number,
): Set<number> {
	const next = new Set(selected);
	if (next.has(id)) next.delete(id);
	else next.add(id);
	return next;
}

export function allSelected(
	selected: ReadonlySet<number>,
	items: readonly { id: number }[],
): boolean {
	return items.length > 0 && selected.size === items.length;
}

export function toggleAll(
	selected: ReadonlySet<number>,
	items: readonly { id: number }[],
): Set<number> {
	return allSelected(selected, items)
		? new Set()
		: new Set(items.map((it) => it.id));
}
