import { describe, expect, it } from "vitest";

import { makeStats } from "#/hooks/combat-test-fixtures";
import { m } from "#/paraglide/messages";

import { increasedPools } from "./increased-pools";

const every = {
	physical: 1,
	cold: 2,
	fire: 3,
	lightning: 4,
	void: 5,
	elementalGlobal: 6,
	elementalWithAttacks: 7,
	melee: 8,
	spell: 9,
	attackSpeed: 10,
	castSpeed: 11,
	criticalChance: 12,
};

const labels = (stats: Parameters<typeof increasedPools>[0]) =>
	increasedPools(stats).map((e) => `${e.label} ${e.value}`);

describe("increasedPools", () => {
	it("lists an attacker's pools in order, without the spell ones", () => {
		expect(labels(makeStats({ increased: every }))).toEqual([
			`${m.stats_increased_physical()} 1`,
			`${m.stats_increased_melee()} 8`,
			`${m.stats_increased_cold()} 2`,
			`${m.stats_increased_fire()} 3`,
			`${m.stats_increased_lightning()} 4`,
			`${m.stats_increased_void()} 5`,
			`${m.stats_increased_elemental()} 6`,
			`${m.stats_increased_elemental_attacks()} 7`,
			`${m.stats_increased_attack_speed()} 10`,
			`${m.stats_increased_global_crit_chance()} 12`,
		]);
	});

	it("lists a caster's pools in order, without the attack ones", () => {
		expect(labels(makeStats({ path: "spell", increased: every }))).toEqual([
			`${m.stats_increased_physical()} 1`,
			`${m.stats_increased_spell()} 9`,
			`${m.stats_increased_cold()} 2`,
			`${m.stats_increased_fire()} 3`,
			`${m.stats_increased_lightning()} 4`,
			`${m.stats_increased_void()} 5`,
			`${m.stats_increased_elemental()} 6`,
			`${m.stats_increased_cast_speed()} 11`,
			`${m.stats_increased_global_crit_chance()} 12`,
		]);
	});

	it("drops the zero pools", () => {
		expect(increasedPools(makeStats())).toEqual([]);
	});
});
