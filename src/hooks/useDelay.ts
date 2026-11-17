import { useEffect, useEffectEvent } from "react";

export function useDelay(
	active: boolean,
	delayMs: number,
	onFire: () => void,
): void {
	const fire = useEffectEvent(onFire);

	useEffect(() => {
		if (!active) return;
		const id = window.setTimeout(() => fire(), delayMs);
		return () => window.clearTimeout(id);
	}, [active, delayMs]);
}
