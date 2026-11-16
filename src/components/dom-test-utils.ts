// DOM helpers shared by the component tests.

/** Narrows a queried node to `type`, failing the test when the DOM moved. */
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
