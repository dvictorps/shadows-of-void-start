import { findNode } from ".";
import { translateNodeName } from "./i18n";
import type { Act } from "./types";

export type NodeClick =
	| { kind: "reenter" }
	| { kind: "walk" }
	| { kind: "stone"; destinationName: string; stones: number }
	| { kind: "no-route"; destinationName: string };

export function resolveNodeClick({
	act,
	nodeId,
	currentLocation,
	unlockedNodeIds,
	teleportStones,
}: {
	act: Act;
	nodeId: string;
	currentLocation: string;
	unlockedNodeIds: ReadonlySet<string>;
	teleportStones: number;
}): NodeClick {
	if (nodeId === currentLocation) return { kind: "reenter" };
	const from = findNode(act, currentLocation);
	if (from?.connections.some((c) => c.id === nodeId)) return { kind: "walk" };
	const destination = findNode(act, nodeId);
	const destinationName = destination ? translateNodeName(destination) : nodeId;
	if (!unlockedNodeIds.has(nodeId) || teleportStones <= 0) {
		return { kind: "no-route", destinationName };
	}
	return { kind: "stone", destinationName, stones: teleportStones };
}
