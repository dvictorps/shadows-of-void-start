import { m } from "#/paraglide/messages";

import { findNode } from ".";
import { translateNodeDescription, translateNodeName } from "./i18n";
import type { Act, WorldNode, WorldViewMode } from "./types";

const CONSUMABLE_HINTS = {
	potion: m.consumable_desc_potion,
	teleport: m.consumable_desc_teleport,
	incense: m.incense_hint,
	element_fire: m.element_desc_fire,
	element_cold: m.element_desc_cold,
	element_lightning: m.element_desc_lightning,
} satisfies Record<string, () => string>;

export type ConsumableHint = keyof typeof CONSUMABLE_HINTS;

export type TextLogTone = "info" | "warning" | "success" | "danger";

export interface TextLogEntry {
	message: string | undefined;
	tone: TextLogTone;
}

export const LOW_HP_FRACTION = 0.3;

export function resolveTextLog({
	act,
	view,
	deathLog,
	consumableHover,
	playerHp,
	maxHp,
	potions,
	hoveredNodeId,
	currentNode,
}: {
	act: Act;
	view: WorldViewMode;
	deathLog: string | null;
	consumableHover: ConsumableHint | null;
	playerHp: number;
	maxHp: number;
	potions: number;
	hoveredNodeId: string | null;
	currentNode: WorldNode | null;
}): TextLogEntry {
	if (deathLog) return { message: deathLog, tone: "danger" };
	if (view === "combat") {
		if (consumableHover) {
			return { message: CONSUMABLE_HINTS[consumableHover](), tone: "info" };
		}
		if (playerHp > 0 && playerHp < maxHp * LOW_HP_FRACTION) {
			return {
				message: potions > 0 ? m.low_hp_use_potion() : m.low_hp_no_potions(),
				tone: "warning",
			};
		}
	}
	if (view === "map") {
		const hovered = hoveredNodeId ? findNode(act, hoveredNodeId) : null;
		const message = hovered
			? (translateNodeDescription(hovered) ?? translateNodeName(hovered))
			: m.act_map_label({ number: 1 });
		return { message, tone: "info" };
	}
	if (currentNode) {
		return {
			message: m.inside_zone({ zone: translateNodeName(currentNode) }),
			tone: "info",
		};
	}
	return { message: undefined, tone: "info" };
}
