// @vitest-environment jsdom

// What the stats modal shows for a character: attributes and their
// tooltips, defenses with the armor / evasion previews against the zone's
// reference enemy, offense for attack, spell, dual wield and unarmed (DPS,
// speed, crit, per-hand damage, the increased pools), and utility. The
// safety net for the ShowStatsModal split (docs/plans/in-progress.md →
// REFACTOR GATE item 7). Pure render: props in, DOM out; expected numbers
// come from the same engine functions, not literals.
//
// - The attribute tooltips are Radix: they need a Provider, and open on focus.

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { afterEach, describe, expect, it, vi } from "vitest";

import { narrow } from "#/components/dom-test-utils";
import {
	computeArmorMitigation,
	computeEvasionAvoid,
	DEX_ACCURACY_PER_POINT,
	DEX_EVASION_PCT_PER_POINT,
	effectiveCritChance,
	INT_BARRIER_PCT_PER_POINT,
	STR_LIFE_PER_POINT,
	STR_MELEE_PCT_PER_POINT,
	totalCritMultiplier,
} from "#/game/stats/compute";
import { estimateDps } from "#/game/stats/dps";
import type { ComputedCharacterStats, SwingProfile } from "#/game/stats/types";
import { makeStats } from "#/hooks/combat-test-fixtures";
import { m } from "#/paraglide/messages";

import ShowStatsModal from "./ShowStatsModal";

type Props = Parameters<typeof ShowStatsModal>[0];

afterEach(cleanup);

function setup(overrides: Partial<Props> = {}) {
	const onClose = vi.fn<() => void>();
	const props: Props = {
		isOpen: true,
		onClose,
		stats: makeStats(),
		referenceEnemyLevel: 1,
		currentBarrier: 0,
		currentLife: 100,
		...overrides,
	};
	render(
		<TooltipPrimitive.Provider delayDuration={0}>
			<ShowStatsModal {...props} />
		</TooltipPrimitive.Provider>,
	);
	return { props, onClose };
}

function swing(overrides: Partial<SwingProfile> = {}): SwingProfile {
	return {
		source: "mainHand",
		itemId: "w1",
		weaponType: "sword",
		physicalDamage: { min: 3, max: 7 },
		elementalDamage: [],
		baseCritChance: 5,
		baseAttackSpeed: 1.2,
		...overrides,
	};
}

/** The section under the heading `heading`. */
function section(heading: string) {
	return narrow(
		screen.getByText(heading, { selector: "h3" }).closest("section"),
		HTMLElement,
	);
}

/** The value cell of the row labelled `label` inside `scope`. */
function value(scope: HTMLElement, label: string) {
	const row = narrow(within(scope).getByText(label).parentElement, HTMLElement);
	return narrow(row.lastElementChild, HTMLElement).textContent;
}

/** The "Increased" block of the offense section (null when hidden). */
function increasedBlock(offense: HTMLElement) {
	const header = within(offense).queryByText(m.stats_increased_header());
	return header ? narrow(header.parentElement, HTMLElement) : null;
}

const defenses = () => section(m.stats_section_defenses());
const offenseAttack = () => section(m.stats_section_offense_attack());

describe("ShowStatsModal — frame", () => {
	it("shows the title and closes on Escape", () => {
		const t = setup();
		expect(screen.getByText(m.stats_title())).toBeTruthy();
		fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
		expect(t.onClose).toHaveBeenCalledTimes(1);
	});

	it("renders nothing while closed", () => {
		setup({ isOpen: false });
		expect(screen.queryByText(m.stats_title())).toBeNull();
	});
});

describe("ShowStatsModal — attributes", () => {
	it("shows each attribute and explains a point of it on focus", async () => {
		setup({
			stats: makeStats({
				attributes: { strength: 21, dexterity: 13, intelligence: 8 },
			}),
		});
		const s = section(m.stats_section_attributes());
		expect(value(s, m.attribute_strength())).toBe("21");
		expect(value(s, m.attribute_dexterity())).toBe("13");
		expect(value(s, m.attribute_intelligence())).toBe("8");
		const cases = [
			[
				m.attribute_strength(),
				m.attribute_tooltip_strength({
					melee: STR_MELEE_PCT_PER_POINT,
					life: STR_LIFE_PER_POINT,
				}),
			],
			[
				m.attribute_dexterity(),
				m.attribute_tooltip_dexterity({
					accuracy: DEX_ACCURACY_PER_POINT,
					evasion: DEX_EVASION_PCT_PER_POINT,
				}),
			],
			[
				m.attribute_intelligence(),
				m.attribute_tooltip_intelligence({
					barrier: INT_BARRIER_PCT_PER_POINT,
				}),
			],
		] as const;
		for (const [label, tooltip] of cases) {
			const row = narrow(within(s).getByText(label).parentElement, HTMLElement);
			await act(async () => {
				fireEvent.focus(row);
			});
			expect(
				screen.getAllByText((_, node) => node?.textContent === tooltip).length,
			).toBeGreaterThan(0);
		}
	});
});

describe("ShowStatsModal — defenses", () => {
	it("shows life against max life", () => {
		setup({ currentLife: 60 });
		expect(value(defenses(), m.stats_life())).toBe("60 / 100");
	});

	it("rounds fractional life up, like the health globe", () => {
		setup({ currentLife: 42.35 });
		expect(value(defenses(), m.stats_life())).toBe("43 / 100");
	});

	it("shows the barrier rounded, only with a max barrier", () => {
		setup({ stats: makeStats({ maxBarrier: 30.4 }), currentBarrier: 12.6 });
		expect(value(defenses(), m.stats_barrier())).toBe("13 / 30");
		cleanup();
		setup();
		expect(within(defenses()).queryByText(m.stats_barrier())).toBeNull();
	});

	it("previews armor and evasion against the reference enemy", () => {
		const level = 7;
		setup({
			stats: makeStats({ armor: 120, evasion: 300 }),
			referenceEnemyLevel: level,
		});
		const armor = computeArmorMitigation(120, Math.max(5, level * 5));
		const avoid = computeEvasionAvoid(300, level * 10);
		expect(value(defenses(), m.stats_armor())).toBe(
			`120(${Math.round(armor.reductionPct)}%)`,
		);
		expect(value(defenses(), m.stats_evasion())).toBe(
			`300(${Math.round(avoid.avoidPct)}%)`,
		);
	});

	it("uses a reference hit of at least 5", () => {
		setup({ stats: makeStats({ armor: 50 }), referenceEnemyLevel: 0 });
		const armor = computeArmorMitigation(50, 5);
		expect(value(defenses(), m.stats_armor())).toBe(
			`50(${Math.round(armor.reductionPct)}%)`,
		);
	});

	it("shows the four resistances and life regen", () => {
		setup({
			stats: makeStats({
				resistances: { cold: 10, fire: -20, lightning: 0, void: 75 },
				lifeRegen: 2.25,
			}),
		});
		const d = defenses();
		expect(value(d, m.stats_resistance_cold())).toBe("10%");
		expect(value(d, m.stats_resistance_fire())).toBe("-20%");
		expect(value(d, m.stats_resistance_lightning())).toBe("0%");
		expect(value(d, m.stats_resistance_void())).toBe("75%");
		expect(value(d, m.stats_life_regen())).toBe(`${(2.25).toFixed(1)} /s`);
	});

	it("shows block only when there is some", () => {
		setup({ stats: makeStats({ blockChance: 15 }) });
		expect(value(defenses(), m.stats_block())).toBe("15%");
		cleanup();
		setup();
		expect(within(defenses()).queryByText(m.stats_block())).toBeNull();
	});
});

describe("ShowStatsModal — offense", () => {
	it("says unarmed with no swings", () => {
		setup({ stats: makeStats({ swings: [] }) });
		const s = section(m.stats_section_offense());
		expect(within(s).getByText(m.stats_unarmed())).toBeTruthy();
	});

	it("says unarmed on the unarmed path", () => {
		setup({ stats: makeStats({ path: "unarmed" }) });
		expect(screen.getByText(m.stats_unarmed())).toBeTruthy();
	});

	it("shows an attacker's DPS, speed, accuracy and crit", () => {
		const stats = makeStats({
			swings: [swing()],
			tickRate: 1.234,
			accuracy: 321,
			bonusCritMultiplier: 30,
			increased: { ...makeStats().increased, criticalChance: 50 },
		});
		setup({ stats });
		// The headline grid; the increased block below repeats "Crit Chance".
		const s = narrow(offenseAttack().querySelector(".grid"), HTMLElement);
		expect(value(s, m.stats_dps())).toBe(String(estimateDps(stats)));
		expect(value(s, m.stats_attack_speed())).toBe("1.23 /s");
		expect(value(s, m.stats_accuracy())).toBe("321");
		expect(value(s, m.stats_crit_chance())).toBe(
			`${effectiveCritChance(5, 50).toFixed(1)}%`,
		);
		expect(value(s, m.stats_crit_multi())).toBe(`${totalCritMultiplier(30)}%`);
	});

	it("shows a caster under the spell heading with cast speed", () => {
		setup({ stats: makeStats({ path: "spell", swings: [swing()] }) });
		const s = section(m.stats_section_offense_spell());
		expect(within(s).getByText(m.stats_cast_speed())).toBeTruthy();
		expect(within(s).queryByText(m.stats_attack_speed())).toBeNull();
	});

	it("lists one weapon's damage per element", () => {
		setup({
			stats: makeStats({
				swings: [
					swing({
						elementalDamage: [
							{ element: "Fire", min: 2, max: 4 },
							{ element: "Cold", min: 1, max: 3 },
						],
					}),
				],
			}),
		});
		const s = offenseAttack();
		expect(within(s).getByText(m.stats_damage())).toBeTruthy();
		expect(value(s, m.element_physical())).toBe("3 – 7");
		expect(value(s, m.element_fire())).toBe("2 – 4");
		expect(value(s, m.element_cold())).toBe("1 – 3");
		expect(within(s).queryByText(m.stats_main_hand())).toBeNull();
	});

	it("lists both hands and the dual-wield notes when dual wielding", () => {
		setup({
			stats: makeStats({
				swings: [
					swing(),
					swing({ source: "offHand", physicalDamage: { min: 1, max: 2 } }),
				],
			}),
		});
		const s = offenseAttack();
		const main = narrow(
			within(s).getByText(m.stats_main_hand()).parentElement,
			HTMLElement,
		);
		const off = narrow(
			within(s).getByText(m.stats_off_hand()).parentElement,
			HTMLElement,
		);
		expect(value(main, m.element_physical())).toBe("3 – 7");
		expect(value(off, m.element_physical())).toBe("1 – 2");
		expect(
			within(s).getByText(
				m.stats_dual_wield_pattern({
					pattern: `${m.stats_main_hand_short()} + ${m.stats_off_hand_short()}`,
				}),
			),
		).toBeTruthy();
		expect(within(s).getByText(m.stats_dual_wield_bonus())).toBeTruthy();
	});

	it("shows each hand's crit chance when dual wielding", () => {
		setup({
			stats: makeStats({
				swings: [
					swing({ baseCritChance: 5 }),
					swing({ source: "offHand", baseCritChance: 9 }),
				],
			}),
		});
		expect(value(offenseAttack(), m.stats_crit_chance())).toBe(
			`${effectiveCritChance(5, 0).toFixed(1)}% / ${effectiveCritChance(9, 0).toFixed(1)}%`,
		);
	});

	it("hides the increased block when every pool is zero", () => {
		setup({ stats: makeStats({ swings: [swing()] }) });
		expect(increasedBlock(offenseAttack())).toBeNull();
	});

	it("lists the non-zero increased pools", () => {
		const base = makeStats().increased;
		setup({
			stats: makeStats({
				swings: [swing()],
				increased: {
					...base,
					physical: 20,
					fire: 15,
					elementalGlobal: 10,
					attackSpeed: 8,
					castSpeed: 99,
					criticalChance: 30,
				},
			}),
		});
		const block = narrow(increasedBlock(offenseAttack()), HTMLElement);
		const rows = [...block.querySelectorAll(".flex.justify-between")].map(
			(r) => r.textContent,
		);
		expect(rows).toEqual([
			`${m.stats_increased_physical()}+20%`,
			`${m.stats_increased_fire()}+15%`,
			`${m.stats_increased_elemental()}+10%`,
			`${m.stats_increased_attack_speed()}+8%`,
			`${m.stats_increased_global_crit_chance()}+30%`,
		]);
	});

	it("shows cast speed, not attack speed, among a caster's pools", () => {
		const base = makeStats().increased;
		setup({
			stats: makeStats({
				path: "spell",
				swings: [swing()],
				increased: { ...base, attackSpeed: 8, castSpeed: 12 },
			}),
		});
		const block = narrow(
			increasedBlock(section(m.stats_section_offense_spell())),
			HTMLElement,
		);
		expect(block.textContent).toContain(
			`${m.stats_increased_cast_speed()}+12%`,
		);
		expect(block.textContent).not.toContain("+8%");
	});

	it("lists the attack-only pools for an attacker", () => {
		const base = makeStats().increased;
		setup({
			stats: makeStats({
				swings: [swing()],
				increased: { ...base, melee: 11, spell: 22, elementalWithAttacks: 33 },
			}),
		});
		const block = narrow(increasedBlock(offenseAttack()), HTMLElement);
		expect(block.textContent).toContain(`${m.stats_increased_melee()}+11%`);
		expect(block.textContent).toContain(
			`${m.stats_increased_elemental_attacks()}+33%`,
		);
		expect(block.textContent).not.toContain("+22%");
	});

	it("lists the spell pool, not the attack ones, for a caster", () => {
		const base = makeStats().increased;
		setup({
			stats: makeStats({
				path: "spell",
				swings: [swing()],
				increased: { ...base, melee: 11, spell: 22, elementalWithAttacks: 33 },
			}),
		});
		const block = narrow(
			increasedBlock(section(m.stats_section_offense_spell())),
			HTMLElement,
		);
		expect(block.textContent).toBe(
			`${m.stats_increased_header()}${m.stats_increased_spell()}+22%`,
		);
	});
});

describe("ShowStatsModal — utility", () => {
	it("shows movement, on-hit, leech, on-kill and magic find", () => {
		const stats: Partial<ComputedCharacterStats> = {
			movementSpeed: 12,
			lifeGainOnHit: 3,
			manaGainOnHit: 2,
			lifeLeechPercent: 1.26,
			lifeOnKill: 5,
			manaOnKill: 4,
			magicFind: 40,
		};
		setup({ stats: makeStats(stats) });
		const s = section(m.stats_section_utility());
		expect(value(s, m.stats_movement_speed())).toBe("+12%");
		expect(value(s, m.stats_life_on_hit())).toBe("3");
		expect(value(s, m.stats_mana_on_hit())).toBe("2");
		expect(value(s, m.stats_life_leech())).toBe("1.3%");
		expect(value(s, m.stats_life_on_kill())).toBe("5");
		expect(value(s, m.stats_mana_on_kill())).toBe("4");
		expect(value(s, m.stats_magic_find())).toBe("+40%");
	});
});
