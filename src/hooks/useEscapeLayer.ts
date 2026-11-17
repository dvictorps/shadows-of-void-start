import { useEffect, useLayoutEffect, useRef } from "react";

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

export function useEscapeLayer(
	active: boolean,
	onEscape: () => void = holdEscape,
): void {
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
