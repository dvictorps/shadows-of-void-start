import { findNode } from ".";
import type { MonsterId } from "../monsters";
import {
	encounterPlanForNode,
	type ZoneEncounterPlan,
} from "./encounter-schedule";
import type { Act, BossNodeConfig, WorldNode } from "./types";

export interface ZoneContext {
	node: WorldNode | null;
	monsterPool: readonly MonsterId[];
	// `null` outside a levelled node (the city); the caller falls back to the
	// character's level.
	level: number | null;
	encounterPlan: ZoneEncounterPlan;
	bossNode: BossNodeConfig | null;
}

/**
 * Everything the combat loop reads from the node the character stands on.
 * Built fresh per call (a boss node's plan is a new object), so callers
 * memoize it on the location to keep the loop's callbacks stable.
 */
export function zoneContextFor(act: Act, location: string): ZoneContext {
	const node = findNode(act, location);
	return {
		node,
		monsterPool: node?.monsterPool ?? [],
		level: node?.level ?? null,
		encounterPlan: encounterPlanForNode(node),
		bossNode: node?.bossNode ?? null,
	};
}
