// @vitest-environment jsdom

// What the vendor modal renders and which callback each interaction makes:
// opening and closing, the Buy / Sell tabs, the ruby balance and its floating
// deltas, the buy cards (stepper, affordability and cap limits, the in-flight
// guard), and the sell grid (selection, total, bulk sell). The safety net for
// the VendorModal split (docs/plans/in-progress.md → REFACTOR GATE item 4).
//
// - The modal takes its calls as props (`onBuy`, `onSellMany`), so they are
//   `vi.fn()` fakes. Sonner's toaster and framer-motion run for real (the
//   deltas' removal timer is not under test).
// - The ruby tooltip is Radix: it needs a Provider, and opens on focus.

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { Toaster, toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { narrow } from "#/components/dom-test-utils";
import { ruleError } from "#/components/trpc-test-utils";
import { MAX_POTIONS } from "#/game/combat/constants";
import { computeSellPrice } from "#/game/items/sell-price";
import type { GeneratedItem } from "#/game/items/types";
import { VENDOR_PRODUCTS } from "#/game/vendor/products";
import { SERVER_ERRORS } from "#/lib/server-errors";
import { m } from "#/paraglide/messages";

import { card, nameOf } from "./dnd-test-harness";
import { helmet, inventoryRow, ring, sword } from "./item-test-fixtures";
import VendorModal from "./VendorModal";

type Props = Parameters<typeof VendorModal>[0];

const POTION_PRICE = VENDOR_PRODUCTS.potion.priceRubys;
const STONE_PRICE = VENDOR_PRODUCTS.teleport_stone.priceRubys;

type Setup = Partial<
	Pick<
		Props,
		"isOpen" | "rubys" | "potions" | "teleportStones" | "inventoryItems"
	>
>;

function setup(overrides: Setup = {}) {
	const onBuy = vi.fn<Props["onBuy"]>(async () => {});
	const onSellMany = vi.fn<Props["onSellMany"]>(async () => {});
	const onClose = vi.fn<() => void>();
	let props: Props = {
		isOpen: true,
		onClose,
		rubys: 1000,
		potions: 0,
		teleportStones: 0,
		inventoryItems: [],
		onBuy,
		onSellMany,
		...overrides,
	};
	const tree = () => (
		<TooltipPrimitive.Provider delayDuration={0}>
			<VendorModal {...props} />
			<Toaster />
		</TooltipPrimitive.Provider>
	);
	const result = render(tree());
	const update = (next: Setup) => {
		props = { ...props, ...next };
		result.rerender(tree());
	};
	return { ...result, onBuy, onSellMany, onClose, update };
}

/** A promise the test settles by hand. */
function deferred() {
	let resolve: () => void = () => {};
	const promise = new Promise<void>((res) => {
		resolve = res;
	});
	return { promise, resolve };
}

// ── DOM lookups ───────────────────────────────────────────────────────────

// The tabs share their names with the action buttons ("Buy", "Sell"); the
// tab strip comes first in the DOM.
const tab = (name: string) =>
	narrow(screen.getAllByRole("button", { name })[0], HTMLElement);
/** The header row: tab strip, then the balance. */
function balance() {
	const header = narrow(tab(m.vendor_tab_buy()).closest(".grid"), HTMLElement);
	return narrow(header.lastElementChild, HTMLElement);
}
function buyCard(label: string) {
	return narrow(screen.getByText(label).closest(".rounded-md"), HTMLElement);
}
const potionCard = () => buyCard(m.vendor_product_potion());
const stoneCard = () => buyCard(m.vendor_product_teleport_stone());
const buyButton = (inCard: HTMLElement) =>
	narrow(within(inCard).getAllByRole("button").at(-1), HTMLButtonElement);
const stepper = (inCard: HTMLElement, name: string) =>
	narrow(within(inCard).getByRole("button", { name }), HTMLButtonElement);
const plus = (inCard: HTMLElement) => stepper(inCard, m.vendor_buy_increment());
const minus = (inCard: HTMLElement) =>
	stepper(inCard, m.vendor_buy_decrement());
const sellButton = () =>
	narrow(
		screen.getAllByRole("button", { name: m.vendor_sell_action() }).at(-1),
		HTMLButtonElement,
	);
const isSelected = (item: GeneratedItem) =>
	card(item).className.includes("ring-white");

async function press(el: HTMLElement) {
	await act(async () => {
		fireEvent.click(el);
	});
}
async function openSell() {
	await press(tab(m.vendor_tab_sell()));
}

afterEach(() => {
	cleanup();
	toast.dismiss();
	vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe("VendorModal — open and close", () => {
	it("renders nothing while closed", () => {
		setup({ isOpen: false });
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("titles the dialog and closes from the header ×, the backdrop and Escape", () => {
		const t = setup();
		expect(screen.getByText(m.vendor_title())).toBeTruthy();
		const closers = screen.getAllByRole("button", {
			name: m.modal_close_label(),
		});
		expect(closers).toHaveLength(2);
		for (const closer of closers) fireEvent.click(closer);
		fireEvent.keyDown(document, { key: "Escape" });
		expect(t.onClose).toHaveBeenCalledTimes(3);
	});

	it("keeps the last tab across a reopen, but starts with nothing selected", async () => {
		const s = sword();
		const t = setup({ inventoryItems: [inventoryRow(1, s, 0)] });
		await openSell();
		await press(card(s));
		expect(isSelected(s)).toBe(true);
		t.update({ isOpen: false });
		t.update({ isOpen: true });
		expect(screen.getByText(m.vendor_sell_pick_items())).toBeTruthy();
		expect(isSelected(s)).toBe(false);
	});
});

describe("VendorModal — header", () => {
	it("opens on Buy and switches between the tabs", async () => {
		setup();
		expect(screen.getByText(m.vendor_product_potion())).toBeTruthy();
		await openSell();
		expect(screen.queryByText(m.vendor_product_potion())).toBeNull();
		expect(screen.getByText(m.vendor_sell_empty())).toBeTruthy();
		await press(tab(m.vendor_tab_buy()));
		expect(screen.getByText(m.vendor_product_potion())).toBeTruthy();
	});

	it("shows the ruby balance", () => {
		setup({ rubys: 321 });
		expect(balance().textContent).toContain("321");
	});

	it("labels the balance with the localized tooltip", async () => {
		setup();
		await act(async () => {
			fireEvent.focus(narrow(balance().firstElementChild, HTMLElement));
		});
		expect(screen.getAllByText(m.ruby_tooltip()).length).toBeGreaterThan(0);
	});
});

describe("VendorModal — buy cards", () => {
	it("shows one card per product with its price, quantity 1 and Buy", () => {
		setup();
		for (const [c, price] of [
			[potionCard(), POTION_PRICE],
			[stoneCard(), STONE_PRICE],
		] as const) {
			expect(c.textContent).toContain(String(price));
			expect(buyButton(c).textContent).toBe(m.vendor_buy_action());
			expect(minus(c).disabled).toBe(true);
		}
	});

	it("steps the quantity, scaling the price and the label", async () => {
		setup();
		const c = potionCard();
		await press(plus(c));
		await press(plus(c));
		expect(c.textContent).toContain(String(POTION_PRICE * 3));
		expect(buyButton(c).textContent).toBe(m.vendor_buy_action_qty({ qty: 3 }));
		await press(minus(c));
		expect(buyButton(c).textContent).toBe(m.vendor_buy_action_qty({ qty: 2 }));
	});

	it("stops the stepper at what the balance affords", async () => {
		setup({ rubys: STONE_PRICE * 2 + 1 });
		const c = stoneCard();
		await press(plus(c));
		expect(plus(c).disabled).toBe(true);
		expect(buyButton(c).textContent).toBe(m.vendor_buy_action_qty({ qty: 2 }));
	});

	it("stops the stepper at the product cap", async () => {
		setup({ potions: MAX_POTIONS - 2 });
		const c = potionCard();
		await press(plus(c));
		expect(plus(c).disabled).toBe(true);
	});

	it("disables a capped product with its own label", () => {
		setup({ potions: MAX_POTIONS });
		const c = potionCard();
		expect(buyButton(c).textContent).toBe(m.vendor_buy_at_cap());
		expect(buyButton(c).disabled).toBe(true);
	});

	it("disables a product the balance can't pay for", () => {
		setup({ rubys: POTION_PRICE - 1 });
		expect(buyButton(potionCard()).disabled).toBe(true);
	});

	it("clamps a chosen quantity down when the balance drops", async () => {
		const t = setup({ rubys: STONE_PRICE * 5 });
		const c = stoneCard();
		for (let i = 0; i < 4; i++) await press(plus(c));
		expect(buyButton(c).textContent).toBe(m.vendor_buy_action_qty({ qty: 5 }));
		t.update({ rubys: STONE_PRICE * 2 });
		expect(buyButton(stoneCard()).textContent).toBe(
			m.vendor_buy_action_qty({ qty: 2 }),
		);
	});
});

describe("VendorModal — buying", () => {
	it("buys the chosen quantity and floats the cost off the balance", async () => {
		const t = setup();
		const c = potionCard();
		await press(plus(c));
		await press(buyButton(c));
		expect(t.onBuy).toHaveBeenCalledWith("potion", 2);
		expect(within(balance()).getByText(`-${POTION_PRICE * 2}`)).toBeTruthy();
	});

	it("blocks a second buy of the same product while one is in flight", async () => {
		const t = setup();
		const pending = deferred();
		t.onBuy.mockReturnValue(pending.promise);
		await press(buyButton(potionCard()));
		expect(buyButton(potionCard()).disabled).toBe(true);
		await press(buyButton(potionCard()));
		expect(t.onBuy).toHaveBeenCalledTimes(1);
		// Another product stays available.
		expect(buyButton(stoneCard()).disabled).toBe(false);
		await act(async () => {
			pending.resolve();
		});
		expect(buyButton(potionCard()).disabled).toBe(false);
	});

	it("gives the cost back and toasts a crash with the buy message", async () => {
		const t = setup();
		t.onBuy.mockRejectedValue(new Error("boom"));
		await press(buyButton(stoneCard()));
		expect(await screen.findByText(m.vendor_buy_failed())).toBeTruthy();
		expect(screen.queryByText("boom")).toBeNull();
		expect(within(balance()).getByText(`+${STONE_PRICE}`)).toBeTruthy();
	});

	it("translates a rule error", async () => {
		const t = setup();
		t.onBuy.mockRejectedValue(ruleError(SERVER_ERRORS.characterNotFound));
		await press(buyButton(stoneCard()));
		expect(await screen.findByText(m.error_character_not_found())).toBeTruthy();
	});

	it.each([
		[SERVER_ERRORS.notEnoughRubys, () => m.error_not_enough_rubys()],
		["potion cap reached", () => m.vendor_buy_at_cap()],
	])("translates the vendor refusal %s", async (raw, expected) => {
		const t = setup();
		t.onBuy.mockRejectedValue(ruleError(raw));
		await press(buyButton(stoneCard()));
		expect(await screen.findByText(expected())).toBeTruthy();
	});

	it("toasts the buy message for a rejection that isn't an Error", async () => {
		const t = setup();
		t.onBuy.mockRejectedValue("offline");
		await press(buyButton(stoneCard()));
		expect(await screen.findByText(m.vendor_buy_failed())).toBeTruthy();
	});
});

describe("VendorModal — sell tab", () => {
	it("says so when the bag is empty", async () => {
		setup();
		await openSell();
		expect(screen.getByText(m.vendor_sell_empty())).toBeTruthy();
		// Only the tab: no Sell action.
		expect(
			screen.getAllByRole("button", { name: m.vendor_sell_action() }),
		).toHaveLength(1);
	});

	it("lists the bag and asks for a pick, Sell disabled", async () => {
		const items = [sword(), ring(), helmet()];
		setup({
			inventoryItems: items.map((item, i) => inventoryRow(i + 1, item, i)),
		});
		await openSell();
		for (const item of items) expect(card(item)).toBeTruthy();
		expect(screen.getByText(m.vendor_sell_pick_items())).toBeTruthy();
		expect(sellButton().disabled).toBe(true);
	});

	it("toggles a pick and totals the sell prices", async () => {
		const a = sword();
		const b = ring();
		setup({ inventoryItems: [inventoryRow(1, a, 0), inventoryRow(2, b, 1)] });
		await openSell();
		await press(card(a));
		await press(card(b));
		expect(isSelected(a)).toBe(true);
		expect(screen.getByText(m.vendor_sell_selected({ count: 2 }))).toBeTruthy();
		const total = computeSellPrice(a) + computeSellPrice(b);
		expect(
			narrow(
				screen.getByText(m.vendor_sell_selected({ count: 2 })).parentElement,
				HTMLElement,
			).textContent,
		).toContain(String(total));
		await press(card(a));
		expect(isSelected(a)).toBe(false);
		expect(screen.getByText(m.vendor_sell_selected({ count: 1 }))).toBeTruthy();
	});

	it("selects and deselects everything", async () => {
		const a = sword();
		const b = ring();
		setup({ inventoryItems: [inventoryRow(1, a, 0), inventoryRow(2, b, 1)] });
		await openSell();
		await press(
			screen.getByRole("button", { name: m.vendor_sell_select_all() }),
		);
		expect(isSelected(a) && isSelected(b)).toBe(true);
		await press(
			screen.getByRole("button", { name: m.vendor_sell_deselect_all() }),
		);
		expect(isSelected(a) || isSelected(b)).toBe(false);
	});
});

describe("VendorModal — selling", () => {
	it("sells the pick in bag order, clears it and floats the total in", async () => {
		const a = sword();
		const b = ring();
		const t = setup({
			inventoryItems: [inventoryRow(1, a, 0), inventoryRow(2, b, 1)],
		});
		await openSell();
		await press(card(b));
		await press(card(a));
		await press(sellButton());
		expect(t.onSellMany).toHaveBeenCalledWith([1, 2]);
		expect(isSelected(a) || isSelected(b)).toBe(false);
		const total = computeSellPrice(a) + computeSellPrice(b);
		expect(within(balance()).getByText(`+${total}`)).toBeTruthy();
	});

	it("disables Sell while the sale is in flight", async () => {
		const a = sword();
		const t = setup({ inventoryItems: [inventoryRow(1, a, 0)] });
		const pending = deferred();
		t.onSellMany.mockReturnValue(pending.promise);
		await openSell();
		await press(card(a));
		await press(sellButton());
		await press(card(a));
		expect(sellButton().disabled).toBe(true);
		await press(sellButton());
		expect(t.onSellMany).toHaveBeenCalledTimes(1);
		await act(async () => {
			pending.resolve();
		});
		expect(sellButton().disabled).toBe(false);
	});

	it("puts the pick back, takes the total back and toasts a crash with the sell message", async () => {
		const a = sword();
		const t = setup({ inventoryItems: [inventoryRow(1, a, 0)] });
		t.onSellMany.mockRejectedValue(new Error("boom"));
		await openSell();
		await press(card(a));
		await press(sellButton());
		expect(await screen.findByText(m.vendor_sell_failed())).toBeTruthy();
		expect(screen.queryByText("boom")).toBeNull();
		expect(isSelected(a)).toBe(true);
		expect(within(balance()).getByText(`-${computeSellPrice(a)}`)).toBeTruthy();
	});

	it("translates a rule error on a failed sale", async () => {
		const a = sword();
		const t = setup({ inventoryItems: [inventoryRow(1, a, 0)] });
		t.onSellMany.mockRejectedValue(ruleError(SERVER_ERRORS.characterNotFound));
		await openSell();
		await press(card(a));
		await press(sellButton());
		expect(await screen.findByText(m.error_character_not_found())).toBeTruthy();
	});

	it("toasts the sell message for a rejection that isn't an Error", async () => {
		const a = sword();
		const t = setup({ inventoryItems: [inventoryRow(1, a, 0)] });
		t.onSellMany.mockRejectedValue("offline");
		await openSell();
		await press(card(a));
		await press(sellButton());
		expect(await screen.findByText(m.vendor_sell_failed())).toBeTruthy();
	});

	it("names each card after its item", async () => {
		const a = sword("Rusty Blade");
		setup({ inventoryItems: [inventoryRow(1, a, 0)] });
		await openSell();
		expect(card(a).getAttribute("aria-label")).toBe(nameOf(a));
	});
});
