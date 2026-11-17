import { elementName } from "#/game/combat/element-name";
import { weaponArchetype } from "#/game/items/equipment";
import {
	DEFAULT_WEAPON_ATTACK_SPEED,
	DEFAULT_WEAPON_CRIT_CHANCE,
	type GeneratedItem,
} from "#/game/items/types";
import { m } from "#/paraglide/messages";

export type StatRow = {
	label: string;
	value: string;
	modified: boolean;
};

function elementDamageLabel(element: string): string {
	return m.tooltip_damage_line({ element: elementName(element) });
}

function isSpellWeapon(item: GeneratedItem): boolean {
	return weaponArchetype(item) === "caster";
}

function isAttackWeapon(item: GeneratedItem): boolean {
	return "minDamage" in item.baseStats && !isSpellWeapon(item);
}

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
				computed.criticalChance !==
					(stats.criticalChance ?? DEFAULT_WEAPON_CRIT_CHANCE),
		});
	}
	const speed = computed?.attackSpeed ?? stats.attackSpeed;
	if (speed != null) {
		rows.push({
			label: m.tooltip_attacks_per_second(),
			value: speed.toFixed(2),
			modified:
				computed != null &&
				computed.attackSpeed !==
					(stats.attackSpeed ?? DEFAULT_WEAPON_ATTACK_SPEED),
		});
	}
	return rows;
}

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
