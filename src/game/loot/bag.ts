import { computeBagKeepCap } from "../combat/constants";
import { INVENTORY_MAX_SLOTS } from "../inventory/constants";

// Zone-bag decisions (CONTEXT.md → Loot Pipeline / Bag retention tiers) for
// the `items.exitZone` / `pickFromBag` / `discardFromBag` procedures. The
// procedures pass the bag ids the server stored and the ids the client asked
// for; ids that aren't in the bag are dropped here, never trusted.

export const PICK_CAMP_ONLY =
	"pickFromBag is camp-only — must commit via exitZone";
export const DISCARD_CAMP_ONLY =
	"discardFromBag is camp-only — must commit via exitZone";

export type BagExitDecision =
	| { ok: false; error: string }
	| { ok: true; keep: string[] };

/**
 * Leaving the zone: keep what the player picked, discard the rest. Outside a
 * camp the keep count is capped at 30% of the bag (the server derives the
 * phase from `inCamp`; the client never sends it).
 */
export function resolveBagExit(params: {
	bagIds: readonly string[];
	keepIds: readonly string[];
	inCamp: boolean;
	inventoryUsed: number;
}): BagExitDecision {
	const requested = new Set(params.keepIds);
	const keep = params.bagIds.filter((id) => requested.has(id));
	const phase = params.inCamp ? "camp" : "combat";
	const cap = computeBagKeepCap(params.bagIds.length, phase);
	if (phase !== "camp" && keep.length > cap) {
		return {
			ok: false,
			error: `Phase cap exceeded: kept ${keep.length} > cap ${cap} for phase ${phase}`,
		};
	}
	const total = params.inventoryUsed + keep.length;
	if (total > INVENTORY_MAX_SLOTS) {
		return {
			ok: false,
			error: `Inventory overflow: ${total} > ${INVENTORY_MAX_SLOTS}`,
		};
	}
	return { ok: true, keep };
}

/**
 * Camp pick-up: moves bag items to the inventory while the zone goes on.
 * Unknown ids are skipped and the pick stops quietly when the inventory is
 * full.
 */
export function resolveBagPick(params: {
	bagIds: readonly string[];
	pickIds: readonly string[];
	inventoryUsed: number;
}): string[] {
	const inBag = new Set(params.bagIds);
	const room = Math.max(0, INVENTORY_MAX_SLOTS - params.inventoryUsed);
	return [...new Set(params.pickIds)]
		.filter((id) => inBag.has(id))
		.slice(0, room);
}
