import { computeBagKeepCap } from "../combat/constants";
import { INVENTORY_MAX_SLOTS } from "../inventory/constants";

export const PICK_CAMP_ONLY =
	"pickFromBag is camp-only — must commit via exitZone";
export const DISCARD_CAMP_ONLY =
	"discardFromBag is camp-only — must commit via exitZone";

export type BagExitDecision =
	| { ok: false; error: string }
	| { ok: true; keep: string[] };

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
