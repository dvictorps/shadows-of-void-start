import { type CombatPhase, computeBagKeepCap } from "./constants";

export type ZoneExitPlan =
	// The bag hasn't loaded yet: deciding now would silently drop the loot.
	| { kind: "wait" }
	// Nothing staged: leave straight away.
	| { kind: "leave" }
	// Items staged: the exit modal decides, capped by the phase's retention
	// tier, frozen at open time so incremental picks don't shrink the cap.
	| { kind: "pick"; keepCap: number };

/**
 * How a manual exit (Retreat or the HUD Teleport Stone) handles the zone bag.
 * See CONTEXT.md → Bag retention tiers and → Inventory overflow and
 * exit-modal flow.
 */
export function planZoneExit(
	bagSize: number | undefined,
	phase: CombatPhase,
): ZoneExitPlan {
	if (bagSize === undefined) return { kind: "wait" };
	if (bagSize === 0) return { kind: "leave" };
	return { kind: "pick", keepCap: computeBagKeepCap(bagSize, phase) };
}
