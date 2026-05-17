import { m } from "#/paraglide/messages";
import type { WorldNode } from "./types";

/**
 * Resolve a world-node's display name through the active locale's messages.
 * Falls back to the data's canonical English `name` for unknown ids — keeps
 * future zones rendering even before translations land.
 */
export function translateNodeName(node: WorldNode): string {
	switch (node.id) {
		case "city":
			return m.zone_city();
		case "forest_starter":
			return m.zone_forest_starter();
		default:
			return node.name;
	}
}
