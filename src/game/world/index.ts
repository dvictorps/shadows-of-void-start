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

/**
 * True if the node's progression gate is satisfied. City and ungated nodes
 * (entry zones) always pass. See CONTEXT.md → Progression gating.
 */
export function isNodeAccessible(
	node: WorldNode,
	completedZones: ReadonlySet<string> | readonly string[] | undefined,
): boolean {
	if (!node.gatedBy || node.gatedBy.length === 0) return true;
	const completed =
		completedZones instanceof Set
			? completedZones
			: new Set(completedZones ?? []);
	return node.gatedBy.every((id) => completed.has(id));
}

export type { Act, NodeKind, WorldNode } from "./types";
export { ACT_1 };
