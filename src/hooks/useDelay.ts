import { useEffect, useRef } from "react";

/**
 * Fires `onFire` once after `delayMs` while `active` is true. Cancelled if
 * `active` flips to false before the timer elapses, or on unmount. Companion
 * to useTicker for one-shot timeouts (search delay, victory pause, etc.).
 */
export function useDelay(
	active: boolean,
	delayMs: number,
	onFire: () => void,
): void {
	const callbackRef = useRef(onFire);
	callbackRef.current = onFire;

	useEffect(() => {
		if (!active) return;
		const id = window.setTimeout(() => callbackRef.current(), delayMs);
		return () => window.clearTimeout(id);
	}, [active, delayMs]);
}
