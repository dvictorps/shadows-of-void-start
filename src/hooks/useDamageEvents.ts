import type { WeaponType } from "#/game/items/types/base";

import { useExpiringList } from "./useExpiringList";

export type DamageEvent = {
	id: string;
	amount: number;
	target: "player" | "enemy";
	isCrit?: boolean;
	isMiss?: boolean;
	isBlocked?: boolean;
	isThorns?: boolean;
	isHealing?: boolean;
	weaponType?: WeaponType;
};

const EVENT_LIFETIME_MS = 900;

export function useDamageEvents() {
	const { items: events, push } =
		useExpiringList<Omit<DamageEvent, "id">>(EVENT_LIFETIME_MS);
	return { events, push };
}
