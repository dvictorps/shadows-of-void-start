import { useEffect, useEffectEvent } from "react";

/**
 * Fires `onTick` at a fixed interval while `active` is true. The callback is
 * wrapped in an Effect Event so the interval doesn't restart when the
 * callback's closure changes between renders — only `active` and
 * `intervalMs` cause a restart.
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
	// Effect Event: always calls the latest `onTick` without making the
	// callback a dependency, so a new closure each render never restarts the
	// timer.
	const tick = useEffectEvent(onTick);

	useEffect(() => {
		if (!active) return;
		const id = window.setInterval(() => tick(), intervalMs);
		return () => window.clearInterval(id);
	}, [active, intervalMs]);
}
