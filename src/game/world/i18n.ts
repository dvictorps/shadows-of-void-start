import type { MonsterDefinition, MonsterId } from "#/game/monsters";
import { m } from "#/paraglide/messages";
import type { WorldNode } from "./types";

// Lookup table over hand-coded switches: adding a zone is a one-line entry
// instead of two parallel switch cases. The `description` slot is optional —
// zones without a description return null and the caller falls back to the
// node name.
const NODE_I18N: Record<
	string,
	{ name: () => string; description?: () => string }
> = {
	city: { name: m.zone_city, description: m.zone_city_description },
	forest_starter: {
		name: m.zone_forest_starter,
		description: m.zone_forest_starter_description,
	},
	forest_profunda: {
		name: m.zone_forest_profunda,
		description: m.zone_forest_profunda_description,
	},
	pantano: { name: m.zone_pantano, description: m.zone_pantano_description },
	cripta: { name: m.zone_cripta, description: m.zone_cripta_description },
	castelo: { name: m.zone_castelo, description: m.zone_castelo_description },
	fenda_vazio: {
		name: m.zone_fenda_vazio,
		description: m.zone_fenda_vazio_description,
	},
};

/**
 * Resolve a world-node's display name through the active locale's messages.
 * Falls back to the data's canonical `name` for unknown ids so future zones
 * render even before translations land.
 */
export function translateNodeName(node: WorldNode): string {
	return NODE_I18N[node.id]?.name() ?? node.name;
}

/**
 * Resolve a world-node's flavor description, or null when none exists. The
 * caller (TextLog) falls back to the node name in that case.
 */
export function translateNodeDescription(node: WorldNode): string | null {
	return NODE_I18N[node.id]?.description?.() ?? null;
}

const MONSTER_I18N: Record<MonsterId, () => string> = {
	goblin: m.monster_goblin,
	slime: m.monster_slime,
	macaco: m.monster_macaco,
	morcego: m.monster_morcego,
	serpente: m.monster_serpente,
	esqueleto: m.monster_esqueleto,
	esqueleto_armadurado: m.monster_esqueleto_armadurado,
	esqueleto_lanca: m.monster_esqueleto_lanca,
	zumbi: m.monster_zumbi,
	vampiro: m.monster_vampiro,
	lich: m.monster_lich,
	olho_do_vazio: m.monster_olho_do_vazio,
	criatura_do_vazio: m.monster_criatura_do_vazio,
};

/**
 * Resolve a monster's display name through the active locale. Falls back to
 * the data's canonical `name` for unknown ids (defensive against persisted
 * data referencing a deleted monster).
 */
export function translateMonsterName(def: MonsterDefinition): string {
	return MONSTER_I18N[def.id as MonsterId]?.() ?? def.name;
}
