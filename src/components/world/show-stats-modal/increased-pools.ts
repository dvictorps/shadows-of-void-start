import type { ComputedCharacterStats } from "#/game/stats/types";
import { m } from "#/paraglide/messages";

/**
 * The non-zero `% increased` pools the sheet lists, in display order. Only
 * the pools the character's path uses: an attacker sees melee, elemental
 * with attacks and attack speed; a caster sees spell and cast speed. The
 * same split `estimateDps` applies.
 */
export function increasedPools(
	stats: Pick<ComputedCharacterStats, "increased" | "path">,
) {
	const i = stats.increased;
	const attack = stats.path === "attack";
	const pathPools = attack
		? {
				damage: { label: m.stats_increased_melee(), value: i.melee },
				elemental: [
					{
						label: m.stats_increased_elemental_attacks(),
						value: i.elementalWithAttacks,
					},
				],
				speed: {
					label: m.stats_increased_attack_speed(),
					value: i.attackSpeed,
				},
			}
		: {
				damage: { label: m.stats_increased_spell(), value: i.spell },
				elemental: [],
				speed: { label: m.stats_increased_cast_speed(), value: i.castSpeed },
			};
	return [
		{ label: m.stats_increased_physical(), value: i.physical },
		pathPools.damage,
		{ label: m.stats_increased_cold(), value: i.cold },
		{ label: m.stats_increased_fire(), value: i.fire },
		{ label: m.stats_increased_lightning(), value: i.lightning },
		{ label: m.stats_increased_void(), value: i.void },
		{ label: m.stats_increased_elemental(), value: i.elementalGlobal },
		...pathPools.elemental,
		pathPools.speed,
		{ label: m.stats_increased_global_crit_chance(), value: i.criticalChance },
	].filter((e) => e.value !== 0);
}
