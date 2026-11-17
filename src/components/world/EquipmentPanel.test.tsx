// @vitest-environment jsdom

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

import { narrow } from "#/components/dom-test-utils";
import { BROKEN_BORDER, RARITY_BORDER } from "#/components/game/ItemCard";
import type { GeneratedItem } from "#/game/items/types";
import type { EquippedSlot } from "#/game/stats/types";
import { makeStats } from "#/hooks/combat-test-fixtures";
import { m } from "#/paraglide/messages";

import { card, nameOf } from "./dnd-test-harness";
import EquipmentPanel from "./EquipmentPanel";
import {
	amulet,
	helmet,
	makeItem,
	quiver,
	ring,
	sword,
	bow,
} from "./item-test-fixtures";

type Props = Parameters<typeof EquipmentPanel>[0];

let compact = false;

beforeAll(() => {
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: (query: string) => ({
			matches: compact,
			media: query,
			addEventListener: () => {},
			removeEventListener: () => {},
		}),
	});
});

afterAll(() => {
	Reflect.deleteProperty(window, "matchMedia");
});

beforeEach(() => {
	compact = false;
});

afterEach(cleanup);

function equipped(
	entries: [EquippedSlot, GeneratedItem][],
): Props["equippedBySlot"] {
	return new Map(entries.map(([at, data]) => [at, { id: data.id, data }]));
}

function setup(overrides: Partial<Props> = {}) {
	const onOpenInventory = vi.fn<() => void>();
	const result = render(
		<TooltipPrimitive.Provider delayDuration={0}>
			<EquipmentPanel
				equippedBySlot={new Map()}
				stats={makeStats()}
				characterLevel={10}
				rubys={0}
				onOpenInventory={onOpenInventory}
				{...overrides}
			/>
		</TooltipPrimitive.Provider>,
	);
	return { ...result, onOpenInventory };
}

const ALL_SLOTS: EquippedSlot[] = [
	"helmet",
	"amulet",
	"weapon",
	"chestplate",
	"offhand",
	"ring1",
	"belt",
	"ring2",
	"gloves",
	"boots",
];

function slot(name: EquippedSlot) {
	return narrow(document.querySelector(`[data-slot="${name}"]`), HTMLElement);
}
function grid() {
	return narrow(slot("helmet").parentElement, HTMLElement);
}

describe("EquipmentPanel — slots", () => {
	it("draws every equipment slot, each labelled while empty", () => {
		setup();
		expect(
			[...grid().children].map((c) => narrow(c, HTMLElement).dataset.slot),
		).toEqual(ALL_SLOTS);
		expect(slot("helmet").textContent).toBe(m.slot_label_helmet());
		expect(slot("amulet").textContent).toBe(m.slot_label_amulet());
		expect(slot("weapon").textContent).toBe(m.slot_label_weapon());
		expect(slot("chestplate").textContent).toBe(m.slot_label_chestplate());
		expect(slot("offhand").textContent).toBe(m.slot_label_offhand());
		expect(slot("ring1").textContent).toBe(m.slot_label_ring());
		expect(slot("ring2").textContent).toBe(m.slot_label_ring());
		expect(slot("belt").textContent).toBe(m.slot_label_belt());
		expect(slot("gloves").textContent).toBe(m.slot_label_gloves());
		expect(slot("boots").textContent).toBe(m.slot_label_boots());
	});

	it("places each grid slot in its own area of the paper doll", () => {
		setup();
		expect(slot("chestplate").style.gridArea).toBe("body");
		expect(slot("ring2").style.gridArea).toBe("ring2");
	});

	it("puts each equipped item in its slot, framed in its rarity", () => {
		const h = makeItem("Rare Helm", {
			equipmentType: "helmet",
			rarity: "rare",
		});
		const left = ring("Left Ring");
		const right = ring("Right Ring");
		setup({
			equippedBySlot: equipped([
				["helmet", h],
				["ring1", left],
				["ring2", right],
			]),
		});
		expect(slot("helmet").contains(card(h))).toBe(true);
		expect(slot("helmet").textContent).not.toContain(m.slot_label_helmet());
		expect(slot("helmet").className).toContain(RARITY_BORDER.rare);
		expect(slot("ring1").contains(card(left))).toBe(true);
		expect(slot("ring2").contains(card(right))).toBe(true);
		expect(slot("amulet").textContent).toBe(m.slot_label_amulet());
	});

	it("shows an equipped item's tooltip on hover", async () => {
		const a = amulet("Hover Amulet");
		setup({ equippedBySlot: equipped([["amulet", a]]) });
		expect(screen.queryByText(nameOf(a))).toBeNull();
		await act(async () => {
			fireEvent.mouseEnter(card(a));
		});
		expect(screen.getByText(nameOf(a))).toBeTruthy();
	});
});

describe("EquipmentPanel — broken items", () => {
	it("frames a broken item as broken and lists why on hover", async () => {
		const heavy = makeItem("Heavy Helm", {
			equipmentType: "helmet",
			rarity: "rare",
			requirements: { level: 20 },
		});
		setup({
			equippedBySlot: equipped([["helmet", heavy]]),
			stats: makeStats({ brokenItemIds: new Set([heavy.id]) }),
			characterLevel: 10,
		});
		expect(slot("helmet").className).toContain(BROKEN_BORDER);
		expect(slot("helmet").className).not.toContain(RARITY_BORDER.rare);
		expect(card(heavy).querySelector("svg")).not.toBeNull();
		await act(async () => {
			fireEvent.mouseEnter(card(heavy));
		});
		expect(
			screen.getByText(m.broken_missing_level({ value: 20 })),
		).toBeTruthy();
	});

	it("reads the main hand for a broken quiver's reason", async () => {
		const reasonCount = async (mainHand: GeneratedItem) => {
			const q = quiver();
			setup({
				equippedBySlot: equipped([
					["weapon", mainHand],
					["offhand", q],
				]),
				stats: makeStats({ brokenItemIds: new Set([q.id]) }),
			});
			await act(async () => {
				fireEvent.mouseEnter(card(q));
			});
			const count = screen.getAllByText(
				m.tooltip_requires_bow_in_main_hand(),
			).length;
			cleanup();
			return count;
		};
		expect(await reasonCount(sword())).toBe(2);
		expect(await reasonCount(bow())).toBe(1);
	});

	it("leaves a healthy item unbadged", () => {
		const h = helmet();
		setup({ equippedBySlot: equipped([["helmet", h]]) });
		expect(card(h).querySelector("svg")).toBeNull();
		expect(slot("helmet").className).not.toContain(BROKEN_BORDER);
	});
});

describe("EquipmentPanel — corner widgets", () => {
	it("opens the inventory from the backpack button", () => {
		const t = setup();
		fireEvent.click(screen.getByRole("button", { name: m.open_inventory() }));
		expect(t.onOpenInventory).toHaveBeenCalledOnce();
	});

	it("shows the ruby balance", () => {
		setup({ rubys: 42 });
		const counter = screen.getByRole("img", {
			name: m.ruby_balance_label({ count: 42 }),
		});
		expect(counter.textContent).toContain("42");
	});
});

describe("EquipmentPanel — viewport", () => {
	it("sizes the grid and its slots down on a compact viewport", () => {
		setup();
		expect(grid().style.gridTemplateColumns).toBe("repeat(3, 120px)");
		expect(grid().style.gridTemplateRows).toBe("120px 170px 104px 120px");
		expect(slot("weapon").style.width).toBe("120px");
		expect(slot("weapon").style.height).toBe("170px");
		cleanup();
		compact = true;
		setup();
		expect(grid().style.gridTemplateColumns).toBe("repeat(3, 78px)");
		expect(grid().style.gridTemplateRows).toBe("78px 111px 68px 78px");
		expect(slot("weapon").style.width).toBe("78px");
		expect(slot("weapon").style.height).toBe("111px");
	});
});
