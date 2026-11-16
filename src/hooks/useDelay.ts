import { useEffect, useEffectEvent } from "react";

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
	// Effect Event: always calls the latest `onFire` without making the
	// callback a dependency, so a new closure each render never restarts the
	// timer.
	const fire = useEffectEvent(onFire);

	useEffect(() => {
		if (!active) return;
		const id = window.setTimeout(() => fire(), delayMs);
		return () => window.clearTimeout(id);
	}, [active, delayMs]);
}
