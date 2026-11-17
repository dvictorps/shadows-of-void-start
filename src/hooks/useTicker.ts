import { useEffect, useEffectEvent } from "react";

export function useTicker(
	active: boolean,
	intervalMs: number,
	onTick: () => void,
): void {
	const tick = useEffectEvent(onTick);

	useEffect(() => {
		if (!active) return;
		const id = window.setInterval(() => tick(), intervalMs);
		return () => window.clearInterval(id);
	}, [active, intervalMs]);
}
