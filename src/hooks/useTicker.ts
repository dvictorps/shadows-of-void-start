import { useEffect, useRef } from "react";

/**
 * Fires `onTick` at a fixed interval while `active` is true. The callback is
 * stored in a ref so the interval doesn't restart when the callback's closure
 * changes between renders — only `active` and `intervalMs` cause a restart.
 *
 * This is the single primitive other "ticking" hooks build on: useLifeRegen,
 * combat tick, periodic syncs, etc. Keeps the useEffect count low across the
 * codebase by funneling all interval lifecycles through here.
 */
export function useTicker(
	active: boolean,
	intervalMs: number,
	onTick: () => void,
): void {
	const callbackRef = useRef(onTick);
	callbackRef.current = onTick;

	useEffect(() => {
		if (!active) return;
		const id = window.setInterval(() => callbackRef.current(), intervalMs);
		return () => window.clearInterval(id);
	}, [active, intervalMs]);
}
