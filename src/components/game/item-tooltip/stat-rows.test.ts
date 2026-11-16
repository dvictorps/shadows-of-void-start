import { describe, expect, it } from "vitest";

import {
	makeItem,
	shield,
	sword,
	wand,
} from "#/components/world/item-test-fixtures";
import { m } from "#/paraglide/messages";

import { attackWeaponRows, defenseRows, spellWeaponRows } from "./stat-rows";

const blade = (overrides: Parameters<typeof makeItem>[1]) =>
	makeItem("Blade", overrides);

describe("attackWeaponRows", () => {
	it("is empty for anything but an attack weapon", () => {
		expect(attackWeaponRows(shield())).toEqual([]);
		expect(
			attackWeaponRows({
				...wand(),
				baseStats: { minDamage: 1, maxDamage: 2 },
			}),
		).toEqual([]);
	});

	it("reads the base stats when nothing is computed", () => {
		expect(
			attackWeaponRows(
				blade({
					equipmentType: "weapon",
					weaponType: "sword",
					baseStats: { minDamage: 5, maxDamage: 9, attackSpeed: 1.3 },
				}),
			),
		).toEqual([
			{ label: m.tooltip_physical_damage(), value: "5-9", modified: false },
			{ label: m.tooltip_attacks_per_second(), value: "1.30", modified: false },
		]);
	});

	it("flags what the computed stats changed, and every elemental line", () => {
		const rows = attackWeaponRows(
			blade({
				equipmentType: "weapon",
				weaponType: "sword",
				baseStats: { minDamage: 5, maxDamage: 9 },
				computedStats: {
					physicalDamage: { min: 5, max: 9 },
					elementalDamage: [{ element: "Cold", min: 1, max: 3 }],
					attackSpeed: 1,
					criticalChance: 7.5,
				},
			}),
		);
		expect(rows.map((r) => [r.value, r.modified])).toEqual([
			["5-9", false],
			["1-3", true],
			// No base crit: compared against the default 5.
			["7.5%", true],
			// No base speed: compared against the default 1.
			["1.00", false],
		]);
		expect(rows[1].label).toBe(
			m.tooltip_damage_line({ element: m.element_cold() }),
		);
	});
});

describe("spellWeaponRows", () => {
	it("shows spell damage and base crit, unflagged; nothing for other items", () => {
		expect(
			spellWeaponRows({
				...wand(),
				baseStats: { minDamage: 2, maxDamage: 6, criticalChance: 7 },
			}),
		).toEqual([
			{ label: m.tooltip_spell_damage(), value: "2-6", modified: false },
			{
				label: m.tooltip_critical_strike_chance(),
				value: "7.0%",
				modified: false,
			},
		]);
		expect(spellWeaponRows(sword())).toEqual([]);
	});
});

describe("defenseRows", () => {
	it("lists the defenses the base carries, flagged only where the value changed", () => {
		expect(
			defenseRows({
				...shield(),
				baseStats: { armor: 20, blockChance: 25 },
				computedDefenseStats: { armor: 26, blockChance: 25 },
			}),
		).toEqual([
			{ label: m.tooltip_armour(), value: "26", modified: true },
			{ label: m.tooltip_block_chance(), value: "25%", modified: false },
		]);
		expect(defenseRows(sword())).toEqual([]);
	});
});
