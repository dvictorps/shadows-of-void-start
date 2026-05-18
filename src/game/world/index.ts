import { ACT_1 } from "./act-1";
import type { Act, WorldNode } from "./types";

const ACTS: Record<string, Act> = {
	"act-1": ACT_1,
};

export function findAct(id: string): Act | null {
	return ACTS[id] ?? null;
}

export function findNode(act: Act, nodeId: string): WorldNode | null {
	return act.nodes.find((n) => n.id === nodeId) ?? null;
}

export type { Act, NodeKind, WorldNode } from "./types";
export { ACT_1 };
