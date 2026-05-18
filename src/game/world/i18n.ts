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

/**
 * Resolve a world-node's flavor description. Returns null for nodes without
 * a description key — the caller (TextLog) falls back to the node name so
 * adding a zone before its copy is written doesn't break the UI.
 */
export function translateNodeDescription(node: WorldNode): string | null {
	switch (node.id) {
		case "city":
			return m.zone_city_description();
		case "forest_starter":
			return m.zone_forest_starter_description();
		default:
			return null;
	}
}
