import type { MonsterId } from "../monsters";

export type NodeKind = "city" | "combat" | "boss";

export interface NodeConnection {
	// Target node id. Edges are undirected; list each connection on at least
	// one side (renderer dedupes).
	id: string;
	// Travel distance in abstract units. Feeds the travel-time formula
	// (see `src/game/world/travel.ts` → computeTravelTime).
	distance: number;
}

export interface WorldNode {
	id: string;
	name: string;
	kind: NodeKind;
	// Logical position on the map (0..1 in x/y). The renderer maps these onto pixels.
	position: { x: number; y: number };
	connections: NodeConnection[];
	// Monster ids eligible to spawn in this node. Only set for combat nodes.
	monsterPool?: MonsterId[];
	// Zone level — drives monster instance level (±1) and drop ilvl. Only set
	// for combat / boss nodes.
	level?: number;
}

export interface Act {
	id: string;
	name: string;
	nodes: WorldNode[];
}
