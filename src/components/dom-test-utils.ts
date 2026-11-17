export function narrow<T extends Element>(
	node: Element | null | undefined,
	type: abstract new (...args: never[]) => T,
): T {
	if (!(node instanceof type)) {
		throw new Error(
			`expected a ${type.name}, got ${node?.tagName ?? "nothing"}`,
		);
	}
	return node;
}
