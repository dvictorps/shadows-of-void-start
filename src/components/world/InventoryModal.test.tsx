// @vitest-environment jsdom

// What the inventory modal renders and which server call each interaction
// makes: opening and closing, the bag grid and the paper doll, the click
// menu, equip / unequip / swap hands / reorder / discard (by click and by
// drag), broken items and the error toasts. The safety net for the
// InventoryModal split (docs/plans/in-progress.md → agent-ergonomics item 4).
//
// - The server is the `server` prop (the bundle `useInventoryMutations`
//   returns, passed down by the route), so the calls are `vi.fn()` fakes, not
//   module mocks. The modal's optimistic writes live in that hook; here the
//   fakes just resolve or reject. The confirmation dialog and sonner's toaster
//   run for real.
// - Drag runs through dnd-kit's real PointerSensor on the shared harness
//   (`dnd-test-harness.ts`: the layout and `animate` stubs, the cleanup).

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import { Toaster } from "sonner";
import { describe, expect, it, vi } from "vitest";

import { narrow } from "#/components/dom-test-utils";
import { INVENTORY_MAX_SLOTS } from "#/game/inventory/constants";
import type { GeneratedItem } from "#/game/items/types";
import type { ComputedCharacterStats, EquippedSlot } from "#/game/stats/types";
import { makeStats } from "#/hooks/combat-test-fixtures";
import { ConfirmationProvider } from "#/hooks/useConfirmationModal";
import type { ItemRow } from "#/lib/api-types";
import { m } from "#/paraglide/messages";
import type { AppRouter } from "#/server/trpc/router";

import {
	card,
	drag,
	dragExpectingLive,
	installDragHarness,
	nameOf,
	startDrag,
} from "./dnd-test-harness";
import InventoryModal, { type InventoryServer } from "./InventoryModal";
import {
	amulet,
	bow,
	CHARACTER_ID,
	dagger,
	equippedRow,
	greatsword,
	helmet,
	inventoryRow,
	makeItem,
	quiver,
	ring,
	shield,
	sword,
	tome,
	wand,
} from "./item-test-fixtures";

function fakeServer() {
	return {
		reorderInventory: vi.fn<InventoryServer["reorderInventory"]>(
			async () => ({}),
		),
		equipItem: vi.fn<InventoryServer["equipItem"]>(async () => ({})),
		unequipItem: vi.fn<InventoryServer["unequipItem"]>(async () => ({})),
		swapHands: vi.fn<InventoryServer["swapHands"]>(async () => ({})),
		discardFromInventory: vi.fn<InventoryServer["discardFromInventory"]>(
			async () => ({}),
		),
	};
}

type Setup = {
	isOpen?: boolean;
	equipped?: ItemRow[];
	inventory?: ItemRow[];
	stats?: ComputedCharacterStats;
	characterLevel?: number;
};

function setup({
	isOpen = true,
	equipped = [],
	inventory = [],
	stats = makeStats(),
	characterLevel = 10,
}: Setup = {}) {
	const server = fakeServer();
	const onClose = vi.fn<() => void>();
	const result = render(
		<ConfirmationProvider>
			<InventoryModal
				isOpen={isOpen}
				onClose={onClose}
				characterId={CHARACTER_ID}
				stats={stats}
				characterLevel={characterLevel}
				equippedItems={equipped}
				inventoryItems={inventory}
				server={server}
			/>
			<Toaster />
		</ConfirmationProvider>,
	);
	return { ...result, server, onClose };
}

/** A tRPC rule violation, the way the client receives one. */
function ruleError(message: string) {
	return TRPCClientError.from<AppRouter>({
		error: {
			message,
			code: -32_600,
			data: { code: "BAD_REQUEST", httpStatus: 400 },
		},
	});
}

// ── DOM lookups ───────────────────────────────────────────────────────────

// The paper doll's order, two per row.
const SLOT_ORDER: EquippedSlot[] = [
	"helmet",
	"amulet",
	"weapon",
	"offhand",
	"chestplate",
	"belt",
	"gloves",
	"boots",
	"ring1",
	"ring2",
];

function dialog() {
	return screen.getAllByRole("dialog")[0];
}
function section(header: string) {
	return narrow(screen.getByText(header).closest("section"), HTMLElement);
}
function equipCell(slot: EquippedSlot) {
	const grid = narrow(
		section(m.inventory_equipped_header()).querySelector(".grid"),
		HTMLElement,
	);
	return narrow(grid.children[SLOT_ORDER.indexOf(slot)], HTMLElement);
}
function bagCells() {
	const grid = narrow(
		section(m.inventory_bag_header()).querySelector(".grid"),
		HTMLElement,
	);
	return [...grid.children];
}
function bagCell(slot: number) {
	return narrow(bagCells()[slot], HTMLElement);
}
/**
 * The draggable wrapper (dnd-kit gives it `role="button"`) around the card in
 * `cell`. It carries the drag opacity. Looked up by cell because the drag
 * overlay holds a second card with the same name.
 */
function dragSlotIn(cell: Element) {
	return narrow(cell.querySelector("button")?.parentElement, HTMLElement);
}
function swapButton() {
	return narrow(
		screen.getByRole("button", { name: m.inventory_swap_hands() }),
		HTMLButtonElement,
	);
}
function menuLabels() {
	return within(screen.getByRole("menu"))
		.getAllByRole("button")
		.map((b) => b.textContent);
}
async function openMenu(item: GeneratedItem) {
	await act(async () => {
		fireEvent.click(card(item));
	});
}
async function chooseAction(label: string) {
	await act(async () => {
		fireEvent.click(
			within(screen.getByRole("menu")).getByRole("button", { name: label }),
		);
	});
}

async function confirmDiscard() {
	await act(async () => {
		fireEvent.click(
			screen.getByRole("button", { name: m.inventory_discard_action() }),
		);
	});
}

// Highlight classes the slots wear while dragging.
const STRONG = "ring-yellow-300/90";
const SOFT = "ring-yellow-300/40";
const INVALID = "ring-red-500/70";
const BAG_OVER = "ring-yellow-300/80";

installDragHarness();

// ── Tests ─────────────────────────────────────────────────────────────────

describe("InventoryModal — open and close", () => {
	it("renders nothing while closed", () => {
		setup({ isOpen: false });
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("titles the dialog with the used / total count", () => {
		setup({ inventory: [inventoryRow(1, sword(), 0)] });
		expect(
			screen.getByText(
				m.inventory_title({ used: 1, total: INVENTORY_MAX_SLOTS }),
			),
		).toBeTruthy();
	});

	it("closes from the footer button, the backdrop and Escape", () => {
		const t = setup();
		// No header ×: the backdrop and the footer are the only Close buttons.
		const closers = screen.getAllByRole("button", {
			name: m.modal_close_label(),
		});
		expect(closers).toHaveLength(2);
		fireEvent.click(
			within(dialog()).getByRole("button", { name: m.modal_close_label() }),
		);
		expect(t.onClose).toHaveBeenCalledTimes(1);
		const backdrop = closers.find((b) => !dialog().contains(b));
		fireEvent.click(narrow(backdrop, HTMLButtonElement));
		expect(t.onClose).toHaveBeenCalledTimes(2);
		fireEvent.keyDown(window, { key: "Escape" });
		expect(t.onClose).toHaveBeenCalledTimes(3);
	});
});

describe("InventoryModal — bag grid and paper doll", () => {
	it("draws every bag slot and puts each item in its own", () => {
		const s = sword();
		const r = ring();
		setup({ inventory: [inventoryRow(1, s, 0), inventoryRow(2, r, 12)] });
		expect(bagCells()).toHaveLength(INVENTORY_MAX_SLOTS);
		expect(bagCell(0).contains(card(s))).toBe(true);
		expect(bagCell(12).contains(card(r))).toBe(true);
		expect(within(bagCell(1)).queryByRole("button")).toBeNull();
	});

	it("counts the free slots, singular at one", () => {
		const full = Array.from({ length: INVENTORY_MAX_SLOTS - 1 }, (_, i) =>
			inventoryRow(
				i + 1,
				makeItem(`Filler ${i}`, { equipmentType: "belt" }),
				i,
			),
		);
		setup({ inventory: full });
		expect(
			screen.getByText(m.inventory_free_slot_one({ count: 1 })),
		).toBeTruthy();
	});

	it("labels the empty paper-doll slots in layout order", () => {
		setup();
		const labels = SLOT_ORDER.map((slot) => equipCell(slot).textContent);
		expect(labels).toEqual([
			m.slot_label_helmet(),
			m.slot_label_amulet(),
			m.slot_label_weapon(),
			m.slot_label_offhand(),
			m.slot_label_chestplate(),
			m.slot_label_belt(),
			m.slot_label_gloves(),
			m.slot_label_boots(),
			m.slot_label_ring(),
			m.slot_label_ring(),
		]);
	});

	it("shows an equipped item's card instead of the slot label", () => {
		const h = helmet();
		setup({ equipped: [equippedRow(1, h, "helmet")] });
		expect(equipCell("helmet").contains(card(h))).toBe(true);
		expect(equipCell("helmet").textContent).not.toContain(
			m.slot_label_helmet(),
		);
	});
});

describe("InventoryModal — context menu", () => {
	const cases: Array<[string, GeneratedItem, string[]]> = [
		[
			"a 1H weapon offers both hands",
			sword(),
			[m.equip_main_hand(), m.equip_off_hand()],
		],
		[
			"a caster 1H weapon offers both hands",
			wand(),
			[m.equip_main_hand(), m.equip_off_hand()],
		],
		[
			"a 2H weapon offers the main hand only",
			greatsword(),
			[m.equip_main_hand()],
		],
		["a bow offers the main hand only", bow(), [m.equip_main_hand()]],
		[
			"a shield offers the generic off-hand equip",
			shield(),
			[m.equip_generic()],
		],
		["a tome offers the generic off-hand equip", tome(), [m.equip_generic()]],
		[
			"a quiver offers the generic off-hand equip",
			quiver(),
			[m.equip_generic()],
		],
		[
			"a ring offers both ring slots",
			ring(),
			[m.equip_ring_1(), m.equip_ring_2()],
		],
		["armor offers the generic equip", helmet(), [m.equip_generic()]],
		["jewelry offers the generic equip", amulet(), [m.equip_generic()]],
	];

	it.each(cases)("%s, then Discard", async (_, item, equips) => {
		setup({ inventory: [inventoryRow(1, item, 0)] });
		await openMenu(item);
		expect(menuLabels()).toEqual([...equips, m.inventory_discard_action()]);
		// The divider sits above Discard whenever there is an equip action.
		expect(screen.getByRole("menu").querySelector(".h-px")).not.toBeNull();
	});

	it("an item with no valid slot offers Discard alone, without the divider", async () => {
		const odd = makeItem("Odd Weapon", { equipmentType: "weapon" });
		setup({ inventory: [inventoryRow(1, odd, 0)] });
		await openMenu(odd);
		expect(menuLabels()).toEqual([m.inventory_discard_action()]);
		expect(screen.getByRole("menu").querySelector(".h-px")).toBeNull();
	});

	it("an equipped item offers Unequip only", async () => {
		const h = helmet();
		setup({ equipped: [equippedRow(1, h, "helmet")] });
		await openMenu(h);
		expect(menuLabels()).toEqual([m.unequip_action()]);
	});

	it("closes after an action, on a click outside and on Escape", async () => {
		const s = sword();
		setup({ inventory: [inventoryRow(1, s, 0)] });
		await openMenu(s);
		await chooseAction(m.equip_main_hand());
		expect(screen.queryByRole("menu")).toBeNull();

		await openMenu(s);
		await act(async () => {
			fireEvent.pointerDown(document.body);
		});
		expect(screen.queryByRole("menu")).toBeNull();

		await openMenu(s);
		await act(async () => {
			fireEvent.keyDown(document, { key: "Escape" });
		});
		expect(screen.queryByRole("menu")).toBeNull();
	});

	it("Escape with the menu open closes the menu only; the next one closes the modal", async () => {
		const s = sword();
		const t = setup({ inventory: [inventoryRow(1, s, 0)] });
		await openMenu(s);
		await act(async () => {
			fireEvent.keyDown(document, { key: "Escape" });
		});
		expect(screen.queryByRole("menu")).toBeNull();
		expect(t.onClose).not.toHaveBeenCalled();
		await act(async () => {
			fireEvent.keyDown(document, { key: "Escape" });
		});
		expect(t.onClose).toHaveBeenCalledTimes(1);
	});
});

describe("InventoryModal — equip by click", () => {
	const cases: Array<[GeneratedItem, string, EquippedSlot]> = [
		[sword(), m.equip_main_hand(), "weapon"],
		[sword(), m.equip_off_hand(), "offhand"],
		[shield(), m.equip_generic(), "offhand"],
		[ring(), m.equip_ring_1(), "ring1"],
		[ring(), m.equip_ring_2(), "ring2"],
		[helmet(), m.equip_generic(), "helmet"],
	];

	it.each(cases)("%#: sends the chosen slot", async (item, label, slot) => {
		const t = setup({ inventory: [inventoryRow(4, item, 0)] });
		await openMenu(item);
		await chooseAction(label);
		expect(t.server.equipItem).toHaveBeenCalledWith({
			characterId: CHARACTER_ID,
			itemId: 4,
			targetSlot: slot,
		});
	});

	it("leaves the off-hand rules to the server and toasts its refusal", async () => {
		// planEquip runs server-side (and in the hook's optimistic body); the
		// modal sends the equip and shows the translated rule.
		const q = quiver();
		const t = setup({ inventory: [inventoryRow(4, q, 0)] });
		t.server.equipItem.mockRejectedValue(ruleError("Cannot equip: needs-bow"));
		await openMenu(q);
		await chooseAction(m.equip_generic());
		expect(t.server.equipItem).toHaveBeenCalledOnce();
		expect(await screen.findByText(m.error_needs_bow())).toBeTruthy();
	});

	it("toasts the needs-main-hand refusal for an off-hand weapon", async () => {
		const s = sword();
		const t = setup({ inventory: [inventoryRow(4, s, 0)] });
		t.server.equipItem.mockRejectedValue(
			ruleError("Cannot equip: needs-main-hand"),
		);
		await openMenu(s);
		await chooseAction(m.equip_off_hand());
		expect(await screen.findByText(m.error_needs_main_hand())).toBeTruthy();
	});

	it("falls back to the generic message on a crash", async () => {
		const h = helmet();
		const t = setup({ inventory: [inventoryRow(4, h, 0)] });
		t.server.equipItem.mockRejectedValue(new Error("network down"));
		await openMenu(h);
		await chooseAction(m.equip_generic());
		expect(await screen.findByText(m.error_equip_failed())).toBeTruthy();
	});
});

describe("InventoryModal — unequip by click", () => {
	it("sends the equipped slot", async () => {
		const r = ring();
		const t = setup({ equipped: [equippedRow(3, r, "ring2")] });
		await openMenu(r);
		await chooseAction(m.unequip_action());
		expect(t.server.unequipItem).toHaveBeenCalledWith({
			characterId: CHARACTER_ID,
			slot: "ring2",
		});
	});

	it("toasts a full bag with the translated message", async () => {
		const h = helmet();
		const full = Array.from({ length: INVENTORY_MAX_SLOTS }, (_, i) =>
			inventoryRow(
				i + 10,
				makeItem(`Filler ${i}`, { equipmentType: "belt" }),
				i,
			),
		);
		const t = setup({
			equipped: [equippedRow(3, h, "helmet")],
			inventory: full,
		});
		expect(
			screen.getByText(m.inventory_free_slot_other({ count: 0 })),
		).toBeTruthy();
		t.server.unequipItem.mockRejectedValue(
			ruleError("Inventory full — free a slot first"),
		);
		await openMenu(h);
		await chooseAction(m.unequip_action());
		// The modal doesn't pre-check the bag: the server decides.
		expect(t.server.unequipItem).toHaveBeenCalledOnce();
		expect(await screen.findByText(m.error_inventory_overflow())).toBeTruthy();
	});

	it("falls back to the generic message on a crash", async () => {
		const h = helmet();
		const t = setup({ equipped: [equippedRow(3, h, "helmet")] });
		t.server.unequipItem.mockRejectedValue(new Error("boom"));
		await openMenu(h);
		await chooseAction(m.unequip_action());
		expect(await screen.findByText(m.error_unequip_failed())).toBeTruthy();
	});
});

describe("InventoryModal — swap hands button", () => {
	const blocked: Array<[string, ItemRow[]]> = [
		["empty hands", []],
		["a lone main hand", [equippedRow(1, sword(), "weapon")]],
		[
			"a shield in the off hand",
			[equippedRow(1, sword(), "weapon"), equippedRow(2, shield(), "offhand")],
		],
		[
			"mixed archetypes",
			[equippedRow(1, sword(), "weapon"), equippedRow(2, wand(), "offhand")],
		],
		[
			"a bow with a quiver",
			[equippedRow(1, bow(), "weapon"), equippedRow(2, quiver(), "offhand")],
		],
	];

	it.each(blocked)(
		"is disabled with %s, with the reason as title",
		(_, equipped) => {
			const t = setup({ equipped });
			expect(swapButton().disabled).toBe(true);
			expect(swapButton().title).toBe(
				m.inventory_swap_hands_tooltip_disabled(),
			);
			fireEvent.click(swapButton());
			expect(t.server.swapHands).not.toHaveBeenCalled();
		},
	);

	it("swaps two same-archetype 1H weapons", async () => {
		const t = setup({
			equipped: [
				equippedRow(1, sword(), "weapon"),
				equippedRow(2, dagger(), "offhand"),
			],
		});
		expect(swapButton().disabled).toBe(false);
		expect(swapButton().title).toBe("");
		await act(async () => {
			fireEvent.click(swapButton());
		});
		expect(t.server.swapHands).toHaveBeenCalledWith({
			characterId: CHARACTER_ID,
		});
	});

	it("toasts a failed swap with its own message", async () => {
		const t = setup({
			equipped: [
				equippedRow(1, sword(), "weapon"),
				equippedRow(2, dagger(), "offhand"),
			],
		});
		t.server.swapHands.mockRejectedValue(new Error("boom"));
		await act(async () => {
			fireEvent.click(swapButton());
		});
		expect(await screen.findByText(m.error_swap_hands_failed())).toBeTruthy();
	});
});

describe("InventoryModal — discard", () => {
	it("asks first, naming the item, and does nothing on Cancel", async () => {
		const s = sword("Rusty Blade");
		const t = setup({ inventory: [inventoryRow(5, s, 0)] });
		await openMenu(s);
		await chooseAction(m.inventory_discard_action());
		expect(
			screen.getByText(m.inventory_discard_title({ name: "Rusty Blade" })),
		).toBeTruthy();
		expect(screen.getByText(m.inventory_discard_message())).toBeTruthy();
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: m.cancel() }));
		});
		expect(t.server.discardFromInventory).not.toHaveBeenCalled();
	});

	it("discards on confirm", async () => {
		const s = sword();
		const t = setup({ inventory: [inventoryRow(5, s, 0)] });
		await openMenu(s);
		await chooseAction(m.inventory_discard_action());
		await confirmDiscard();
		expect(t.server.discardFromInventory).toHaveBeenCalledWith({
			characterId: CHARACTER_ID,
			itemId: 5,
		});
	});

	it("Escape on the confirmation cancels it and keeps the modal open", async () => {
		const s = sword();
		const t = setup({ inventory: [inventoryRow(5, s, 0)] });
		await openMenu(s);
		await chooseAction(m.inventory_discard_action());
		await act(async () => {
			fireEvent.keyDown(document, { key: "Escape" });
		});
		expect(screen.queryByText(m.inventory_discard_message())).toBeNull();
		expect(t.server.discardFromInventory).not.toHaveBeenCalled();
		expect(t.onClose).not.toHaveBeenCalled();
		expect(dialog()).toBeTruthy();
	});

	it("toasts a failed discard", async () => {
		const s = sword();
		const t = setup({ inventory: [inventoryRow(5, s, 0)] });
		t.server.discardFromInventory.mockRejectedValue(new Error("boom"));
		await openMenu(s);
		await chooseAction(m.inventory_discard_action());
		await confirmDiscard();
		expect(await screen.findByText(m.error_discard_failed())).toBeTruthy();
	});
});

describe("InventoryModal — broken items", () => {
	it("badges a broken equipped item and lists the reasons on hover", async () => {
		const heavy = makeItem("Heavy Helm", {
			equipmentType: "helmet",
			requirements: { level: 20, str: 30 },
		});
		setup({
			equipped: [equippedRow(1, heavy, "helmet")],
			stats: makeStats({ brokenItemIds: new Set([heavy.id]) }),
			characterLevel: 10,
		});
		expect(card(heavy).querySelector("svg")).not.toBeNull();
		await act(async () => {
			fireEvent.mouseEnter(card(heavy));
		});
		expect(
			screen.getByText(m.broken_missing_level({ value: 20 })),
		).toBeTruthy();
		expect(
			screen.getByText(m.broken_missing_strength({ value: 20 })),
		).toBeTruthy();
	});

	it("names the missing bow for a broken quiver", async () => {
		const q = quiver();
		setup({
			equipped: [
				equippedRow(1, sword(), "weapon"),
				equippedRow(2, q, "offhand"),
			],
			stats: makeStats({ brokenItemIds: new Set([q.id]) }),
		});
		await act(async () => {
			fireEvent.mouseEnter(card(q));
		});
		// Twice: the broken warning on top, and the quiver's own requirement line.
		expect(
			screen.getAllByText(m.tooltip_requires_bow_in_main_hand()),
		).toHaveLength(2);
	});

	it("leaves a healthy item unbadged", () => {
		const h = helmet();
		setup({ equipped: [equippedRow(1, h, "helmet")] });
		expect(card(h).querySelector("svg")).toBeNull();
	});
});

describe("InventoryModal — drag in the bag (reorder)", () => {
	it("moves onto an empty slot without a swap partner", async () => {
		const s = sword();
		const t = setup({ inventory: [inventoryRow(1, s, 0)] });
		await drag(s, bagCell(5));
		expect(t.server.reorderInventory).toHaveBeenCalledWith({
			characterId: CHARACTER_ID,
			itemId: 1,
			targetSlot: 5,
			swapWithItemId: undefined,
		});
	});

	it("swaps with the occupant of a full slot", async () => {
		const s = sword();
		const r = ring();
		const t = setup({
			inventory: [inventoryRow(1, s, 0), inventoryRow(2, r, 3)],
		});
		await drag(s, bagCell(3));
		expect(t.server.reorderInventory).toHaveBeenCalledWith({
			characterId: CHARACTER_ID,
			itemId: 1,
			targetSlot: 3,
			swapWithItemId: 2,
		});
	});

	it("toasts a refused reorder", async () => {
		const s = sword();
		const t = setup({ inventory: [inventoryRow(1, s, 0)] });
		t.server.reorderInventory.mockRejectedValue(new Error("boom"));
		await drag(s, bagCell(5));
		expect(await screen.findByText(m.error_reorder_failed())).toBeTruthy();
	});

	it("does nothing when dropped back on its own slot", async () => {
		const s = sword();
		const t = setup({ inventory: [inventoryRow(1, s, 0)] });
		await dragExpectingLive(s);
		expect(t.server.reorderInventory).not.toHaveBeenCalled();
	});
});

describe("InventoryModal — drag to the paper doll (equip)", () => {
	it("equips on an eligible slot", async () => {
		const r = ring();
		const t = setup({ inventory: [inventoryRow(1, r, 0)] });
		await drag(r, equipCell("ring2"));
		expect(t.server.equipItem).toHaveBeenCalledWith({
			characterId: CHARACTER_ID,
			itemId: 1,
			targetSlot: "ring2",
		});
	});

	it("ignores an ineligible slot (a 2H weapon in the off hand, a helmet on boots)", async () => {
		const gs = greatsword();
		const h = helmet();
		const t = setup({
			inventory: [inventoryRow(1, gs, 0), inventoryRow(2, h, 1)],
		});
		await dragExpectingLive(gs, equipCell("offhand"));
		await dragExpectingLive(h, equipCell("boots"));
		expect(t.server.equipItem).not.toHaveBeenCalled();
	});

	it("toasts a refused drop", async () => {
		const s = sword();
		const t = setup({ inventory: [inventoryRow(1, s, 0)] });
		t.server.equipItem.mockRejectedValue(new Error("boom"));
		await drag(s, equipCell("weapon"));
		expect(await screen.findByText(m.error_equip_failed())).toBeTruthy();
	});

	it("highlights the slots while dragging and hides the source", async () => {
		const h = helmet();
		setup({ inventory: [inventoryRow(1, h, 0)] });
		const drop = await startDrag(h, equipCell("boots"));
		// Hovering an ineligible slot: red ring. The eligible one glows softly.
		expect(equipCell("boots").className).toContain(INVALID);
		expect(equipCell("helmet").className).toContain(SOFT);
		expect(equipCell("gloves").className).not.toMatch(/ring-/);
		// The source hides; the overlay carries a second copy of the card.
		expect(screen.getAllByRole("button", { name: nameOf(h) })).toHaveLength(2);
		expect(dragSlotIn(bagCell(0)).style.opacity).toBe("0");
		await drop();
		expect(screen.getAllByRole("button", { name: nameOf(h) })).toHaveLength(1);
		expect(dragSlotIn(bagCell(0)).style.opacity).toBe("1");
		expect(equipCell("helmet").className).not.toMatch(/ring-/);
	});

	it("rings an eligible slot under the pointer at full strength", async () => {
		const h = helmet();
		setup({ inventory: [inventoryRow(1, h, 0)] });
		const drop = await startDrag(h, equipCell("helmet"));
		expect(equipCell("helmet").className).toContain(STRONG);
		await drop();
	});

	it("rings the bag slot under the pointer", async () => {
		const h = helmet();
		setup({ inventory: [inventoryRow(1, h, 0)] });
		const drop = await startDrag(h, bagCell(7));
		expect(bagCell(7).className).toContain(BAG_OVER);
		expect(bagCell(8).className).not.toContain(BAG_OVER);
		await drop();
	});

	it("cancels on Escape without a call, and the modal stays open", async () => {
		const h = helmet();
		const t = setup({ inventory: [inventoryRow(1, h, 0)] });
		await startDrag(h, equipCell("helmet"));
		await act(async () => {
			// dnd-kit's sensor reads `code`; the Escape layers read `key`.
			fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
		});
		expect(t.server.equipItem).not.toHaveBeenCalled();
		expect(dragSlotIn(bagCell(0)).style.opacity).toBe("1");
		expect(equipCell("helmet").className).not.toMatch(/ring-/);
		expect(t.onClose).not.toHaveBeenCalled();
	});
});

describe("InventoryModal — drag from the paper doll", () => {
	it("unequips onto any bag slot (the slot is ignored)", async () => {
		const h = helmet();
		const t = setup({ equipped: [equippedRow(3, h, "helmet")] });
		await drag(h, bagCell(20));
		expect(t.server.unequipItem).toHaveBeenCalledWith({
			characterId: CHARACTER_ID,
			slot: "helmet",
		});
	});

	it("toasts a refused unequip", async () => {
		const h = helmet();
		const t = setup({ equipped: [equippedRow(3, h, "helmet")] });
		t.server.unequipItem.mockRejectedValue(new Error("boom"));
		await drag(h, bagCell(20));
		expect(await screen.findByText(m.error_unequip_failed())).toBeTruthy();
	});

	it("swaps hands by dragging one weapon onto the other hand", async () => {
		const s = sword();
		const d = dagger();
		const t = setup({
			equipped: [equippedRow(1, s, "weapon"), equippedRow(2, d, "offhand")],
		});
		await drag(d, equipCell("weapon"));
		expect(t.server.swapHands).toHaveBeenCalledWith({
			characterId: CHARACTER_ID,
		});
	});

	it("toasts a failed drag swap with its own message", async () => {
		const s = sword();
		const d = dagger();
		const t = setup({
			equipped: [equippedRow(1, s, "weapon"), equippedRow(2, d, "offhand")],
		});
		t.server.swapHands.mockRejectedValue(new Error("boom"));
		await drag(s, equipCell("offhand"));
		expect(await screen.findByText(m.error_swap_hands_failed())).toBeTruthy();
	});

	it("ignores a hand drop that can't swap, and any other paper-doll drop", async () => {
		const s = sword();
		const sh = shield();
		const h = helmet();
		const t = setup({
			equipped: [
				equippedRow(1, s, "weapon"),
				equippedRow(2, sh, "offhand"),
				equippedRow(3, h, "helmet"),
			],
		});
		await dragExpectingLive(s, equipCell("offhand"));
		await dragExpectingLive(h, equipCell("amulet"));
		expect(t.server.swapHands).not.toHaveBeenCalled();
		expect(t.server.equipItem).not.toHaveBeenCalled();
		expect(t.server.unequipItem).not.toHaveBeenCalled();
	});

	it("lights the opposite hand when the swap is possible", async () => {
		const s = sword();
		const d = dagger();
		setup({
			equipped: [equippedRow(1, s, "weapon"), equippedRow(2, d, "offhand")],
		});
		const away = await startDrag(s, bagCell(0));
		expect(equipCell("offhand").className).toContain(SOFT);
		expect(equipCell("helmet").className).not.toMatch(/ring-/);
		await away();
		const over = await startDrag(s, equipCell("offhand"));
		expect(equipCell("offhand").className).toContain(STRONG);
		await over();
	});

	it("rings the opposite hand red when the swap is blocked", async () => {
		const s = sword();
		const sh = shield();
		setup({
			equipped: [equippedRow(1, s, "weapon"), equippedRow(2, sh, "offhand")],
		});
		const away = await startDrag(s, bagCell(0));
		expect(screen.getAllByRole("button", { name: nameOf(s) })).toHaveLength(2);
		expect(equipCell("offhand").className).not.toMatch(/ring-/);
		await away();
		const over = await startDrag(s, equipCell("offhand"));
		expect(equipCell("offhand").className).toContain(INVALID);
		await over();
	});

	it("lights nothing while dragging a non-hand item", async () => {
		const h = helmet();
		setup({ equipped: [equippedRow(3, h, "helmet")] });
		const drop = await startDrag(h, equipCell("amulet"));
		expect(screen.getAllByRole("button", { name: nameOf(h) })).toHaveLength(2);
		for (const slot of SLOT_ORDER) {
			expect(equipCell(slot).className).not.toMatch(/ring-/);
		}
		await drop();
	});
});
