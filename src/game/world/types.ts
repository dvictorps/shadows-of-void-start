import type { MonsterId } from "#/game/monsters";

export type NodeKind = "city" | "combat" | "boss";

export interface WorldNode {
	id: string;
	name: string;
	kind: NodeKind;
	// Logical position on the map (0..1 in x/y). The renderer maps these onto pixels.
	position: { x: number; y: number };
	// Other node ids that share an edge with this one. Edges are undirected;
	// list each connection on at least one side.
	connections: string[];
	// Monster ids eligible to spawn in this node. Only set for combat nodes.
	monsterPool?: MonsterId[];
}

export interface Act {
	id: string;
	name: string;
	nodes: WorldNode[];
}
