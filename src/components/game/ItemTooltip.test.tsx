// @vitest-environment jsdom

// What the item tooltip shows for each kind of item: the rarity header and
// ornaments, the hand / off-hand line, attack and spell weapon stats, defenses
// (blue only when a local mod changed them), implicits and explicits with the
// (Local) tag, requirements, the broken band and the item level. The safety
// net for the ItemTooltip split (docs/plans/in-progress.md → REFACTOR GATE
// item 5). Pure render: props in, DOM out; expected text comes from the same
// renderers (`m.*`, `translateItemName`, `localizeMod`), not literals.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { narrow } from "#/components/dom-test-utils";
import { RARITY_COLORS } from "#/components/game/rarity-card";
import {
	makeItem,
	quiver,
	ring,
	shield,
	sword,
	tome,
	wand,
} from "#/components/world/item-test-fixtures";
import {
	translateItemName,
	translateTemplateName,
} from "#/game/items/item-name";
import { localizeImplicit, localizeMod } from "#/game/items/mod-i18n";
import type { GeneratedItem, RolledMod } from "#/game/items/types";
import { m } from "#/paraglide/messages";

import ItemTooltip from "./ItemTooltip";

afterEach(cleanup);

function show(item: GeneratedItem, brokenReasons?: string[]) {
	return render(<ItemTooltip item={item} brokenReasons={brokenReasons} />);
}

/** A CSS color as jsdom serializes it, to compare inline styles. */
function css(color: string): string {
	const probe = document.createElement("span");
	probe.style.color = color;
	return probe.style.color;
}
const BLUE = css(RARITY_COLORS.magic);
const WHITE = css("white");

/** The value cell of the stat row labelled `label`. */
function value(label: string) {
	const row = narrow(screen.getByText(label).parentElement, HTMLElement);
	return narrow(row.lastElementChild, HTMLElement);
}

function mod(overrides: Partial<RolledMod> & Pick<RolledMod, "modifierId">) {
	return {
		affixType: "prefix",
		modifierType: "flat",
		isGlobalStat: true,
		tier: 1,
		value: 10,
		description: overrides.modifierId,
		...overrides,
	} satisfies RolledMod;
}

const ornaments = (container: HTMLElement) =>
	container.querySelectorAll(".border-t-2.border-l-2").length;

describe("ItemTooltip — header", () => {
	it("shows a normal item's single name line in its rarity color", () => {
		const r = ring("Plain Band");
		const { container } = show(r);
		const name = screen.getByText(translateItemName(r));
		expect(name.style.color).toBe(css(RARITY_COLORS.normal));
		expect(name.className).toContain("text-lg");
		expect(ornaments(container)).toBe(0);
	});

	it("gives a rare item its generated name over the base name, and ornaments", () => {
		const r = makeItem("Base Ring", { equipmentType: "ring", rarity: "rare" });
		const { container } = show(r);
		expect(screen.getByText(translateItemName(r)).className).toContain(
			"text-lg",
		);
		expect(screen.getByText(translateTemplateName(r)).className).toContain(
			"text-sm",
		);
		expect(ornaments(container)).toBe(1);
	});

	it("keeps a magic item to one line and no ornaments", () => {
		const r = makeItem("Magic Ring", {
			equipmentType: "ring",
			rarity: "magic",
		});
		const { container } = show(r);
		expect(screen.getByText(translateItemName(r))).toBeTruthy();
		expect(ornaments(container)).toBe(0);
	});
});

describe("ItemTooltip — hand line", () => {
	it("says one- or two-handed for a weapon", () => {
		show(sword());
		expect(screen.getByText(m.tooltip_one_handed())).toBeTruthy();
		cleanup();
		show(
			makeItem("Big", { equipmentType: "weapon", weaponType: "greatsword" }),
		);
		expect(screen.getByText(m.tooltip_two_handed())).toBeTruthy();
	});

	it("says off-hand for a shield, a tome and a quiver, and nothing for armor", () => {
		for (const item of [shield(), tome(), quiver()]) {
			show(item);
			expect(screen.getByText(m.tooltip_offhand())).toBeTruthy();
			cleanup();
		}
		show(makeItem("Cap", { equipmentType: "helmet" }));
		expect(screen.queryByText(m.tooltip_offhand())).toBeNull();
		expect(screen.queryByText(m.tooltip_one_handed())).toBeNull();
	});
});

describe("ItemTooltip — attack weapon", () => {
	const base = {
		minDamage: 5,
		maxDamage: 9,
		criticalChance: 5,
		attackSpeed: 1.3,
	};

	it("shows the base line in white when no local mod applies", () => {
		show(
			makeItem("Blade", {
				equipmentType: "weapon",
				weaponType: "sword",
				baseStats: base,
			}),
		);
		expect(value(m.tooltip_physical_damage()).textContent).toBe("5-9");
		expect(value(m.tooltip_physical_damage()).style.color).toBe(WHITE);
		expect(value(m.tooltip_critical_strike_chance()).textContent).toBe("5.0%");
		expect(value(m.tooltip_attacks_per_second()).textContent).toBe("1.30");
	});

	it("shows the computed stats, blue where a local mod changed them", () => {
		show(
			makeItem("Blade", {
				equipmentType: "weapon",
				weaponType: "sword",
				baseStats: base,
				computedStats: {
					physicalDamage: { min: 8, max: 14 },
					elementalDamage: [],
					attackSpeed: 1.3,
					criticalChance: 6,
				},
			}),
		);
		expect(value(m.tooltip_physical_damage()).textContent).toBe("8-14");
		expect(value(m.tooltip_physical_damage()).style.color).toBe(BLUE);
		expect(value(m.tooltip_critical_strike_chance()).style.color).toBe(BLUE);
		expect(value(m.tooltip_attacks_per_second()).style.color).toBe(WHITE);
	});

	it("adds a blue line per element, naming unknown elements as stored", () => {
		show(
			makeItem("Blade", {
				equipmentType: "weapon",
				weaponType: "sword",
				baseStats: base,
				computedStats: {
					physicalDamage: { min: 5, max: 9 },
					elementalDamage: [
						{ element: "Fire", min: 2, max: 4 },
						{ element: "Plasma", min: 1, max: 1 },
					],
					attackSpeed: 1.3,
					criticalChance: 5,
				},
			}),
		);
		const fire = value(m.tooltip_damage_line({ element: m.element_fire() }));
		expect(fire.textContent).toBe("2-4");
		expect(fire.style.color).toBe(BLUE);
		expect(
			screen.getByText(m.tooltip_damage_line({ element: "Plasma" })),
		).toBeTruthy();
	});

	it("drops the crit and speed lines a weapon doesn't carry", () => {
		show(
			makeItem("Club", {
				equipmentType: "weapon",
				weaponType: "mace",
				baseStats: { minDamage: 3, maxDamage: 4 },
			}),
		);
		expect(screen.queryByText(m.tooltip_critical_strike_chance())).toBeNull();
		expect(screen.queryByText(m.tooltip_attacks_per_second())).toBeNull();
	});
});

describe("ItemTooltip — spell weapon", () => {
	it("shows spell damage and base crit, never the attack lines", () => {
		const w = wand();
		show({
			...w,
			baseStats: { minDamage: 2, maxDamage: 6, criticalChance: 7 },
		});
		expect(value(m.tooltip_spell_damage()).textContent).toBe("2-6");
		expect(value(m.tooltip_critical_strike_chance()).textContent).toBe("7.0%");
		expect(screen.queryByText(m.tooltip_physical_damage())).toBeNull();
		expect(screen.queryByText(m.tooltip_attacks_per_second())).toBeNull();
	});
});

describe("ItemTooltip — defenses", () => {
	it("shows each defense, blue only where the computed value differs", () => {
		show(
			makeItem("Plate", {
				equipmentType: "chestplate",
				baseStats: { armor: 40, evasion: 10, barrier: 5 },
				computedDefenseStats: { armor: 52, evasion: 10, barrier: 5 },
			}),
		);
		expect(value(m.tooltip_armour()).textContent).toBe("52");
		expect(value(m.tooltip_armour()).style.color).toBe(BLUE);
		expect(value(m.tooltip_evasion_rating()).style.color).toBe(WHITE);
		expect(value(m.stats_barrier()).textContent).toBe("5");
	});

	it("shows a shield's block chance as a percentage", () => {
		show({ ...shield(), baseStats: { armor: 20, blockChance: 25 } });
		expect(value(m.tooltip_block_chance()).textContent).toBe("25%");
	});
});

describe("ItemTooltip — mods", () => {
	it("lists the implicits in blue", () => {
		const r = {
			...ring(),
			implicits: [{ description: "+12 to Maximum Life", value: 12 }],
		};
		show(r);
		const line = screen.getByText(localizeImplicit(r.implicits[0]));
		expect(line.style.color).toBe(BLUE);
	});

	it("tags only a local increased mod with (Local)", () => {
		const local = mod({
			modifierId: "physicalDamageIncrease",
			modifierType: "increased",
			isGlobalStat: false,
		});
		const flat = mod({ modifierId: "strengthFlat" });
		const item = { ...sword(), explicits: [local, flat] };
		show(item);
		const localLine = narrow(
			screen.getByText(m.mod_local_suffix()).parentElement,
			HTMLElement,
		);
		expect(localLine.textContent).toContain(localizeMod(local, item));
		expect(screen.getAllByText(m.mod_local_suffix())).toHaveLength(1);
		expect(screen.getByText(localizeMod(flat, item))).toBeTruthy();
	});
});

describe("ItemTooltip — requirements and footer", () => {
	it("lists level and attributes in one line, level 1 left out", () => {
		show({ ...sword(), requirements: { level: 20, str: 30, int: 5 } });
		const line = narrow(
			screen.getByText(m.tooltip_requires(), { exact: false }).parentElement,
			HTMLElement,
		);
		expect(line.textContent).toContain(
			[
				m.tooltip_level_value({ value: 20 }),
				m.tooltip_req_strength({ value: 30 }),
				m.tooltip_req_intelligence({ value: 5 }),
			].join(", "),
		);
		cleanup();
		show({ ...sword(), requirements: { level: 1, dex: 8 } });
		expect(
			screen.queryByText(m.tooltip_level_value({ value: 1 }), {
				exact: false,
			}),
		).toBeNull();
	});

	it("shows a level-only requirement", () => {
		show({ ...sword(), requirements: { level: 20 } });
		const line = narrow(
			screen.getByText(m.tooltip_requires(), { exact: false }).parentElement,
			HTMLElement,
		);
		expect(line.textContent).toBe(
			`${m.tooltip_requires()} ${m.tooltip_level_value({ value: 20 })}`,
		);
	});

	it("shows nothing for a level-1 item with no attribute requirement", () => {
		show({ ...sword(), requirements: { level: 1 } });
		expect(
			screen.queryByText(m.tooltip_requires(), { exact: false }),
		).toBeNull();
	});

	it("tells a quiver it needs a bow", () => {
		show(quiver());
		expect(
			screen.getByText(m.tooltip_requires_bow_in_main_hand()),
		).toBeTruthy();
	});

	it("shows the broken reasons on top, one per line", () => {
		show(ring(), ["first reason", "second reason"]);
		const first = screen.getByText("first reason");
		expect(first.parentElement?.className).toContain("bg-red-900/40");
		expect(screen.getByText("second reason")).toBeTruthy();
	});

	it("ends with the item level", () => {
		show({ ...ring(), itemLevel: 37 });
		const footer = narrow(screen.getByText("37").parentElement, HTMLElement);
		expect(footer.textContent).toBe(`${m.tooltip_item_level()}: 37`);
	});
});
