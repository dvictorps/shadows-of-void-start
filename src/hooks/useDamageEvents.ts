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
	// Set for player→enemy hits. Drives the HitFx category (slash/impact/magic).
	weaponType?: WeaponType;
};

const EVENT_LIFETIME_MS = 900;

/**
 * The floating-damage popups: consumers call `push()` and render `events`;
 * each popup drops itself after EVENT_LIFETIME_MS.
 */
export function useDamageEvents() {
	const { items: events, push } =
		useExpiringList<Omit<DamageEvent, "id">>(EVENT_LIFETIME_MS);
	return { events, push };
}
