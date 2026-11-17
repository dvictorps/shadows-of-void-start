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
	level: number | null;
	encounterPlan: ZoneEncounterPlan;
	bossNode: BossNodeConfig | null;
}

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
