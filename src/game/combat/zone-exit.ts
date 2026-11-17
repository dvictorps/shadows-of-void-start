import { type CombatPhase, computeBagKeepCap } from "./constants";

export type ZoneExitPlan =
	| { kind: "wait" }
	| { kind: "leave" }
	| { kind: "pick"; keepCap: number };

export function planZoneExit(
	bagSize: number | undefined,
	phase: CombatPhase,
): ZoneExitPlan {
	if (bagSize === undefined) return { kind: "wait" };
	if (bagSize === 0) return { kind: "leave" };
	return { kind: "pick", keepCap: computeBagKeepCap(bagSize, phase) };
}
