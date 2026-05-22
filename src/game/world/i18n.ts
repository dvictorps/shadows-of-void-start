import type {
	MonsterDefinition,
	MonsterId,
	MonsterModId,
} from "#/game/monsters";
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
 * Resolve a monster's display name through the active locale. When `mods`
 * are provided, their localized names are prefixed onto the base name
 * (PoE-style: "Storm-Hardened Goblin", "Storm-Hardened Vicious Tough Goblin").
 * Up to 3 prefixes — even if more mods land, the head of the list wins.
 * Falls back to the data's canonical `name` for unknown ids.
 */
export function translateMonsterName(
	def: MonsterDefinition,
	mods?: readonly MonsterModId[],
): string {
	const base = MONSTER_I18N[def.id as MonsterId]?.() ?? def.name;
	if (!mods || mods.length === 0) return base;
	const prefixes = mods.slice(0, 3).map(translateMonsterModName).join(" ");
	return `${prefixes} ${base}`;
}

export function translateMonsterModName(id: MonsterModId): string {
	switch (id) {
		case "monsterIncreasedLife":
			return m.monster_mod_increased_life();
		case "monsterIncreasedDamage":
			return m.monster_mod_increased_damage();
		case "monsterIncreasedAttackSpeed":
			return m.monster_mod_increased_attack_speed();
		case "monsterIncreasedEvasion":
			return m.monster_mod_increased_evasion();
		case "monsterIncreasedAccuracy":
			return m.monster_mod_increased_accuracy();
		case "monsterColdResistance":
			return m.monster_mod_cold_resistance();
		case "monsterFireResistance":
			return m.monster_mod_fire_resistance();
		case "monsterLightningResistance":
			return m.monster_mod_lightning_resistance();
		case "monsterVoidResistance":
			return m.monster_mod_void_resistance();
		case "monsterAdditionalBarrier":
			return m.monster_mod_additional_barrier();
		case "monsterMoreArmor":
			return m.monster_mod_more_armor();
	}
}

export function translateMonsterModDescription(id: MonsterModId): string {
	switch (id) {
		case "monsterIncreasedLife":
			return m.monster_mod_increased_life_desc();
		case "monsterIncreasedDamage":
			return m.monster_mod_increased_damage_desc();
		case "monsterIncreasedAttackSpeed":
			return m.monster_mod_increased_attack_speed_desc();
		case "monsterIncreasedEvasion":
			return m.monster_mod_increased_evasion_desc();
		case "monsterIncreasedAccuracy":
			return m.monster_mod_increased_accuracy_desc();
		case "monsterColdResistance":
			return m.monster_mod_cold_resistance_desc();
		case "monsterFireResistance":
			return m.monster_mod_fire_resistance_desc();
		case "monsterLightningResistance":
			return m.monster_mod_lightning_resistance_desc();
		case "monsterVoidResistance":
			return m.monster_mod_void_resistance_desc();
		case "monsterAdditionalBarrier":
			return m.monster_mod_additional_barrier_desc();
		case "monsterMoreArmor":
			return m.monster_mod_more_armor_desc();
	}
}
