// The item tooltip's header-stat blocks as data: one row per stat line, with
// the value already formatted and a flag for "a local mod changed this"
// (painted blue). Pure, tested in stat-rows.test.ts; StatBlock renders them.

import { weaponArchetype } from "#/game/items/equipment";
import type { GeneratedItem } from "#/game/items/types";
import { m } from "#/paraglide/messages";

export type StatRow = {
	label: string;
	value: string;
	modified: boolean;
};

// The crit and speed an attack weapon falls back to when its template
// leaves them out (the generator's defaults).
const DEFAULT_CRIT = 5;
const DEFAULT_ATTACK_SPEED = 1;

// Keyed by the open `element: string` the computed item stats carry; a Map
// keeps the lookup honest about unknown keys (falls back to the raw name).
const ELEMENT_NAME = new Map<string, () => string>([
	["Cold", m.element_cold],
	["Fire", m.element_fire],
	["Lightning", m.element_lightning],
	["Void", m.element_void],
]);

function elementDamageLabel(element: string): string {
	const name = ELEMENT_NAME.get(element)?.() ?? element;
	return m.tooltip_damage_line({ element: name });
}

function isSpellWeapon(item: GeneratedItem): boolean {
	return weaponArchetype(item) === "caster";
}

function isAttackWeapon(item: GeneratedItem): boolean {
	return "minDamage" in item.baseStats && !isSpellWeapon(item);
}

/** Physical, elemental, crit and speed lines of an attack weapon; [] otherwise. */
export function attackWeaponRows(item: GeneratedItem): StatRow[] {
	if (!isAttackWeapon(item)) return [];
	const stats = item.baseStats;
	const computed = item.computedStats;
	const rows: StatRow[] = [
		computed
			? {
					label: m.tooltip_physical_damage(),
					value: `${computed.physicalDamage.min}-${computed.physicalDamage.max}`,
					modified:
						computed.physicalDamage.min !== (stats.minDamage ?? 0) ||
						computed.physicalDamage.max !== (stats.maxDamage ?? 0),
				}
			: {
					label: m.tooltip_physical_damage(),
					value: `${stats.minDamage}-${stats.maxDamage}`,
					modified: false,
				},
	];
	for (const elem of computed?.elementalDamage ?? []) {
		rows.push({
			label: elementDamageLabel(elem.element),
			value: `${elem.min}-${elem.max}`,
			modified: true,
		});
	}
	const crit = computed?.criticalChance ?? stats.criticalChance;
	if (crit != null) {
		rows.push({
			label: m.tooltip_critical_strike_chance(),
			value: `${crit.toFixed(1)}%`,
			modified:
				computed != null &&
				computed.criticalChance !== (stats.criticalChance ?? DEFAULT_CRIT),
		});
	}
	const speed = computed?.attackSpeed ?? stats.attackSpeed;
	if (speed != null) {
		rows.push({
			label: m.tooltip_attacks_per_second(),
			value: speed.toFixed(2),
			modified:
				computed != null &&
				computed.attackSpeed !== (stats.attackSpeed ?? DEFAULT_ATTACK_SPEED),
		});
	}
	return rows;
}

/** Spell damage and base crit of a staff or wand; [] otherwise. */
export function spellWeaponRows(item: GeneratedItem): StatRow[] {
	if (!isSpellWeapon(item)) return [];
	const { minDamage, maxDamage, criticalChance } = item.baseStats;
	const rows: StatRow[] = [];
	if (minDamage != null && maxDamage != null) {
		rows.push({
			label: m.tooltip_spell_damage(),
			value: `${minDamage}-${maxDamage}`,
			modified: false,
		});
	}
	if (criticalChance != null) {
		rows.push({
			label: m.tooltip_critical_strike_chance(),
			value: `${criticalChance.toFixed(1)}%`,
			modified: false,
		});
	}
	return rows;
}

const DEFENSES = [
	{ key: "armor", label: () => m.tooltip_armour(), suffix: "" },
	{ key: "evasion", label: () => m.tooltip_evasion_rating(), suffix: "" },
	{ key: "barrier", label: () => m.stats_barrier(), suffix: "" },
	{ key: "blockChance", label: () => m.tooltip_block_chance(), suffix: "%" },
] as const;

/**
 * The defense lines the base carries. `computedDefenseStats` is always emitted
 * for armor pieces, so "modified" compares values, not presence.
 */
export function defenseRows(item: GeneratedItem): StatRow[] {
	const stats = item.baseStats;
	const computed = item.computedDefenseStats;
	return DEFENSES.filter(({ key }) => key in stats).map(
		({ key, label, suffix }) => {
			const changed = computed?.[key];
			return {
				label: label(),
				value: `${changed ?? stats[key]}${suffix}`,
				modified: changed != null && changed !== stats[key],
			};
		},
	);
}
