import { findNode } from ".";
import { translateNodeName } from "./i18n";
import type { Act } from "./types";

export type NodeClick =
	// The player is already there: enter without travelling.
	| { kind: "reenter" }
	// A direct connection: walk (timed travel).
	| { kind: "walk" }
	// Not connected, but unlocked and a stone is in the bag: offer the jump.
	| { kind: "stone"; destinationName: string; stones: number }
	// Not connected and no jump available.
	| { kind: "no-route"; destinationName: string };

/**
 * What a click on a map node does. The server still validates the route and
 * the progression gate; this only picks the client flow. See CONTEXT.md →
 * Travel system and → Teleport Stone.
 */
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
