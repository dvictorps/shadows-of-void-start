import { useCallback, useEffect, useRef, useState } from "react";
import type { WeaponType } from "#/game/items/types/base";

export type DamageEvent = {
	id: string;
	amount: number;
	target: "player" | "enemy";
	isCrit?: boolean;
	isMiss?: boolean;
	isBlocked?: boolean;
	isThorns?: boolean;
	// Set for player→enemy hits. Drives the HitFx category (slash/impact/magic).
	weaponType?: WeaponType;
};

const EVENT_LIFETIME_MS = 900;

/**
 * Manages a queue of short-lived floating-damage events. Consumers call
 * `push()` and render `events` directly; cleanup happens on a timer so old
 * popups disappear automatically. Pending timers are cleared on unmount so
 * we don't setState on an unmounted component when the player retreats
 * mid-combat.
 */
export function useDamageEvents() {
	const [events, setEvents] = useState<DamageEvent[]>([]);
	const pendingTimers = useRef<Set<number>>(new Set());

	useEffect(() => {
		const timers = pendingTimers.current;
		return () => {
			for (const id of timers) window.clearTimeout(id);
			timers.clear();
		};
	}, []);

	const push = useCallback((event: Omit<DamageEvent, "id">) => {
		const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		setEvents((prev) => [...prev, { ...event, id }]);
		const timerId = window.setTimeout(() => {
			setEvents((prev) => prev.filter((e) => e.id !== id));
			pendingTimers.current.delete(timerId);
		}, EVENT_LIFETIME_MS);
		pendingTimers.current.add(timerId);
	}, []);

	return { events, push };
}
