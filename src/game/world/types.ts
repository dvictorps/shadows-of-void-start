import type { BossId } from "../bosses";
import type { MonsterId } from "../monsters";
import type { ZoneEncounterPlan } from "./encounter-schedule";

export interface BossNodeConfig {
	bossId: BossId;
	warmupSeconds?: number;
	gauntlet: {
		fights: number;
		monsterPool: MonsterId[];
	};
}

export type CampSource = "baked" | "incense";

export type NodeKind = "city" | "combat" | "boss";

export type WorldViewMode = "map" | "city" | "combat";

export interface NodeConnection {
	id: string;
	distance: number;
}

export interface WorldNode {
	id: string;
	name: string;
	kind: NodeKind;
	position: { x: number; y: number };
	connections: NodeConnection[];
	monsterPool?: MonsterId[];
	level?: number;
	gatedBy?: string[];
	encounterPlan?: ZoneEncounterPlan;
	bossNode?: BossNodeConfig;
}

export interface Act {
	id: string;
	name: string;
	nodes: WorldNode[];
}
