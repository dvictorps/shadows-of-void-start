import { useCallback, useEffect, useRef, useState } from "react";

export function useExpiringList<T>(lifetimeMs: number) {
	const [items, setItems] = useState<(T & { id: string })[]>([]);
	const pendingTimers = useRef<Set<number>>(new Set());

	useEffect(() => {
		const timers = pendingTimers.current;
		return () => {
			for (const id of timers) window.clearTimeout(id);
			timers.clear();
		};
	}, []);

	const push = useCallback(
		(item: T) => {
			const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
			setItems((prev) => [...prev, { ...item, id }]);
			const timerId = window.setTimeout(() => {
				setItems((prev) => prev.filter((e) => e.id !== id));
				pendingTimers.current.delete(timerId);
			}, lifetimeMs);
			pendingTimers.current.add(timerId);
		},
		[lifetimeMs],
	);

	const clear = useCallback(() => setItems([]), []);

	return { items, push, clear };
}
