import { useEffect, useLayoutEffect, useRef } from "react";

// Escape closes the top layer only. Every surface that Escape dismisses (a
// modal, a context menu, an in-flight drag) registers a layer while it is
// open; one window listener routes the key to the layer opened last. A layer
// without a handler still takes the key, so it stops there instead of
// reaching what lies beneath.
//
// The listener runs in the capture phase so it sees the stack before any
// bubble-phase handler (dnd-kit's sensor cancels a drag on `document`) can
// change it.
//
// Order is activation order. Effects run child-first, so a parent and a child
// activated in the same commit would stack inverted; every layer today opens
// after its modal (menu, drag, confirmation).

type Layer = { onEscape: () => void };

const stack: Layer[] = [];

const holdEscape = () => {};

function onKeyDown(event: KeyboardEvent) {
	if (event.key !== "Escape" || event.isComposing) return;
	stack.at(-1)?.onEscape();
}

function push(layer: Layer) {
	if (stack.length === 0) window.addEventListener("keydown", onKeyDown, true);
	stack.push(layer);
}

function remove(layer: Layer) {
	const index = stack.indexOf(layer);
	if (index !== -1) stack.splice(index, 1);
	if (stack.length === 0)
		window.removeEventListener("keydown", onKeyDown, true);
}

/**
 * Registers an Escape layer while `active`; the layer opened last wins.
 * Without `onEscape` the layer only holds the key.
 */
export function useEscapeLayer(
	active: boolean,
	onEscape: () => void = holdEscape,
): void {
	// The handler is read at keypress time, so a new `onEscape` never moves
	// the layer in the stack: only `active` registers and removes it.
	const handler = useRef(onEscape);
	useLayoutEffect(() => {
		handler.current = onEscape;
	}, [onEscape]);

	useEffect(() => {
		if (!active) return;
		const layer: Layer = { onEscape: () => handler.current() };
		push(layer);
		return () => remove(layer);
	}, [active]);
}
