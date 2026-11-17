// @vitest-environment jsdom

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { Toaster } from "sonner";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { narrow } from "#/components/dom-test-utils";
import {
	STASH_MAX_SLOTS,
	INVENTORY_MAX_SLOTS,
} from "#/game/inventory/constants";
import { makeStats } from "#/hooks/combat-test-fixtures";
import { ConfirmationProvider } from "#/hooks/useConfirmationModal";
import type { ModalHandle } from "#/hooks/useModal";
import { m } from "#/paraglide/messages";

import { card, drag, installDragHarness } from "./dnd-test-harness";
import type { InventoryServer } from "./InventoryModal";
import {
	bagEntry,
	CHARACTER_ID,
	inventoryRow,
	ring,
	stashRow,
	sword,
} from "./item-test-fixtures";
import { WorldModals } from "./WorldModals";

type Props = Parameters<typeof WorldModals>[0];

const MODALS = [
	"bagModal",
	"exitModal",
	"inventoryModal",
	"vendorModal",
	"stashModal",
	"settingsModal",
] as const;
type ModalKey = (typeof MODALS)[number];

function handle(isOpen: boolean) {
	const fake = {
		isOpen,
		open: vi.fn<() => void>(),
		close: vi.fn<() => void>(),
		toggle: vi.fn<() => void>(),
	};
	return fake satisfies ModalHandle;
}

function fakeInventoryServer() {
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

function fakeCalls() {
	return {
		onExitClose: vi.fn<Props["onExitClose"]>(),
		onPickSelected: vi.fn<Props["onPickSelected"]>(),
		onDiscardSelected: vi.fn<Props["onDiscardSelected"]>(),
		onPickAll: vi.fn<Props["onPickAll"]>(),
		onDiscardAll: vi.fn<Props["onDiscardAll"]>(),
		onVendorBuy: vi.fn<Props["onVendorBuy"]>(async () => {}),
		onVendorSellMany: vi.fn<Props["onVendorSellMany"]>(async () => {}),
		onStashDeposit: vi.fn<Props["onStashDeposit"]>(async (ids) => ({
			deposited: ids.length,
			failed: 0,
		})),
		onStashWithdraw: vi.fn<Props["onStashWithdraw"]>(async (ids) => ({
			withdrawn: ids.length,
			failed: 0,
		})),
		onReorderStash: vi.fn<Props["onReorderStash"]>(),
		inventoryServer: fakeInventoryServer(),
	};
}

type Data = Partial<
	Pick<
		Props,
		| "zoneBag"
		| "exitKeepCap"
		| "equippedItems"
		| "inventoryItems"
		| "stashItems"
		| "rubys"
	>
>;

function setup(open: ModalKey | null, data: Data = {}) {
	const calls = fakeCalls();
	const handles = {
		bagModal: handle(open === "bagModal"),
		exitModal: handle(open === "exitModal"),
		inventoryModal: handle(open === "inventoryModal"),
		vendorModal: handle(open === "vendorModal"),
		stashModal: handle(open === "stashModal"),
		settingsModal: handle(open === "settingsModal"),
	};
	render(
		<ConfirmationProvider>
			<TooltipPrimitive.Provider delayDuration={0}>
				<WorldModals
					{...handles}
					{...calls}
					zoneBag={undefined}
					exitKeepCap={10}
					stats={makeStats()}
					characterId={CHARACTER_ID}
					characterLevel={10}
					equippedItems={undefined}
					inventoryItems={undefined}
					stashItems={undefined}
					rubys={1000}
					potions={0}
					teleportStones={0}
					{...data}
				/>
				<Toaster />
			</TooltipPrimitive.Provider>
		</ConfirmationProvider>,
	);
	return { ...calls, ...handles };
}

const TITLES = {
	bagModal: () => m.loot_title({ count: 0 }),
	exitModal: () => m.loot_found_title(),
	inventoryModal: () =>
		m.inventory_title({ used: 0, total: INVENTORY_MAX_SLOTS }),
	vendorModal: () => m.vendor_title(),
	stashModal: () => m.stash_title({ used: 0, total: STASH_MAX_SLOTS }),
	settingsModal: () => m.settings_title(),
} satisfies Record<ModalKey, () => string>;

async function press(el: HTMLElement) {
	await act(async () => {
		fireEvent.click(el);
	});
}
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const dialog = () => screen.getByRole("dialog");
const escape = () =>
	fireEvent.keyDown(document, { key: "Escape", code: "Escape" });

installDragHarness();

beforeAll(() => {
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: (query: string) => ({
			matches: false,
			media: query,
			addEventListener: () => {},
			removeEventListener: () => {},
		}),
	});
	Object.defineProperty(globalThis, "ResizeObserver", {
		configurable: true,
		value: class {
			observe() {}
			unobserve() {}
			disconnect() {}
		},
	});
});

afterAll(() => {
	Reflect.deleteProperty(window, "matchMedia");
	Reflect.deleteProperty(globalThis, "ResizeObserver");
});

describe("WorldModals — which modal is open", () => {
	it("renders no dialog while every handle is closed", () => {
		setup(null);
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it.each(MODALS)("%s open shows that modal alone", (key) => {
		setup(key);
		expect(screen.getAllByRole("dialog")).toHaveLength(1);
		expect(within(dialog()).getByText(TITLES[key]())).toBeTruthy();
	});

	const closers: Array<[ModalKey, ModalKey | "onExitClose"]> = [
		["bagModal", "bagModal"],
		["exitModal", "onExitClose"],
		["inventoryModal", "inventoryModal"],
		["vendorModal", "vendorModal"],
		["stashModal", "stashModal"],
		["settingsModal", "settingsModal"],
	];

	it.each(closers)("%s closes through %s", (key, expected) => {
		const t = setup(key);
		escape();
		const closed = [
			...MODALS.filter((other) => t[other].close.mock.calls.length > 0),
			...(t.onExitClose.mock.calls.length > 0 ? ["onExitClose"] : []),
		];
		expect(closed).toEqual([expected]);
	});
});

describe("WorldModals — bag and exit", () => {
	it("shows the empty bag while the zone bag is still loading", () => {
		setup("bagModal");
		expect(screen.getByText(m.loot_bag_empty_combat())).toBeTruthy();
	});

	it("lists the zone bag in the preview", () => {
		const a = sword();
		const b = ring();
		setup("bagModal", { zoneBag: [bagEntry("b1", a), bagEntry("b2", b)] });
		expect(screen.getByText(m.loot_title({ count: 2 }))).toBeTruthy();
		expect(card(a)).toBeTruthy();
		expect(card(b)).toBeTruthy();
	});

	it("picks the whole zone bag through onPickAll", async () => {
		const t = setup("exitModal", {
			zoneBag: [bagEntry("b1", sword()), bagEntry("b2", ring())],
		});
		await press(button(m.loot_pick_all_button()));
		expect(t.onPickAll).toHaveBeenCalledWith(["b1", "b2"]);
	});

	it("picks the selection through onPickSelected", async () => {
		const s = sword();
		const t = setup("exitModal", {
			zoneBag: [bagEntry("b1", s), bagEntry("b2", ring())],
		});
		await press(card(s));
		await press(button(m.loot_pick_selected_button({ count: 1 })));
		expect(t.onPickSelected).toHaveBeenCalledWith(["b1"]);
	});

	it("caps what can be kept at the exit keep cap", () => {
		setup("exitModal", {
			zoneBag: [bagEntry("b1", sword()), bagEntry("b2", ring())],
			exitKeepCap: 1,
		});
		expect(
			screen.getByText(m.loot_keep_cap_hint({ selected: 0, cap: 1 })),
		).toBeTruthy();
		expect(
			screen.queryByRole("button", { name: m.loot_pick_all_button() }),
		).toBeNull();
	});
});

describe("WorldModals — inventory", () => {
	it("counts the inventory it is given in the title", () => {
		setup("inventoryModal", { inventoryItems: [inventoryRow(1, sword(), 0)] });
		expect(
			screen.getByText(
				m.inventory_title({ used: 1, total: INVENTORY_MAX_SLOTS }),
			),
		).toBeTruthy();
	});

	it("equips through the inventory server with the character id", async () => {
		const s = sword();
		const t = setup("inventoryModal", {
			inventoryItems: [inventoryRow(4, s, 0)],
		});
		await press(card(s));
		await press(
			within(screen.getByRole("menu")).getByRole("button", {
				name: m.equip_main_hand(),
			}),
		);
		expect(t.inventoryServer.equipItem).toHaveBeenCalledWith({
			characterId: CHARACTER_ID,
			itemId: 4,
			targetSlot: "weapon",
		});
	});
});

describe("WorldModals — vendor", () => {
	it("buys through onVendorBuy", async () => {
		const t = setup("vendorModal");
		const potionCard = narrow(
			screen.getByText(m.vendor_product_potion()).closest(".rounded-md"),
			HTMLElement,
		);
		await press(
			narrow(within(potionCard).getAllByRole("button").at(-1), HTMLElement),
		);
		expect(t.onVendorBuy).toHaveBeenCalledWith("potion", 1);
	});

	it("sells the inventory it is given through onVendorSellMany", async () => {
		const s = sword();
		const t = setup("vendorModal", { inventoryItems: [inventoryRow(3, s, 0)] });
		await press(
			screen.getAllByRole("button", { name: m.vendor_tab_sell() })[0],
		);
		await press(card(s));
		await press(
			narrow(
				screen.getAllByRole("button", { name: m.vendor_sell_action() }).at(-1),
				HTMLElement,
			),
		);
		expect(t.onVendorSellMany).toHaveBeenCalledWith([3]);
	});
});

describe("WorldModals — stash", () => {
	const section = (header: string) =>
		narrow(
			screen.getByText(header, { selector: "h3" }).closest("section"),
			HTMLElement,
		);
	const cellOf = (header: string, slot: number) =>
		narrow(
			narrow(section(header).querySelector(".grid"), HTMLElement).children[
				slot
			],
			HTMLElement,
		);
	const invCell = (slot: number) => cellOf(m.stash_inventory_header(), slot);
	const stashCell = (slot: number) => cellOf(m.stash_header(), slot);

	it("shows an empty stash while the stash is still loading", () => {
		setup("stashModal");
		expect(screen.getByText(m.stash_empty())).toBeTruthy();
	});

	it("deposits and withdraws through the stash callbacks", async () => {
		const a = sword();
		const b = ring();
		const t = setup("stashModal", {
			inventoryItems: [inventoryRow(1, a, 0)],
			stashItems: [stashRow(5, b, 0)],
		});
		await press(card(a));
		await press(button(new RegExp(`^${m.stash_deposit_selected()}`)));
		expect(t.onStashDeposit).toHaveBeenCalledWith([1]);
		await press(card(b));
		await press(button(new RegExp(`^${m.stash_withdraw_selected()}`)));
		expect(t.onStashWithdraw).toHaveBeenCalledWith([5]);
	});

	it("reorders the stash through onReorderStash", async () => {
		const a = sword();
		const t = setup("stashModal", { stashItems: [stashRow(1, a, 0)] });
		await drag(a, stashCell(7));
		expect(t.onReorderStash).toHaveBeenCalledWith({
			itemId: 1,
			targetSlot: 7,
			swapWithItemId: undefined,
		});
	});

	it("reorders the bag through the inventory server, with the character id", async () => {
		const a = sword();
		const t = setup("stashModal", { inventoryItems: [inventoryRow(1, a, 0)] });
		await drag(a, invCell(5));
		expect(t.inventoryServer.reorderInventory).toHaveBeenCalledWith({
			characterId: CHARACTER_ID,
			itemId: 1,
			targetSlot: 5,
			swapWithItemId: undefined,
		});
	});

	it("toasts a refused bag reorder", async () => {
		const a = sword();
		const t = setup("stashModal", { inventoryItems: [inventoryRow(1, a, 0)] });
		t.inventoryServer.reorderInventory.mockRejectedValue(new Error("boom"));
		await drag(a, invCell(5));
		expect(await screen.findByText(m.error_reorder_failed())).toBeTruthy();
	});
});
