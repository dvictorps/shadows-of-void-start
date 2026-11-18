// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import { Toaster } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { narrow } from "#/components/dom-test-utils";
import {
	resetViewport,
	resizeViewport,
	stageElement,
} from "#/components/game-stage/stage-test-utils";
import GameStage from "#/components/GameStage";
import { ruleError } from "#/components/trpc-test-utils";
import {
	INVENTORY_MAX_SLOTS,
	STASH_MAX_SLOTS,
} from "#/game/inventory/constants";
import type { GeneratedItem } from "#/game/items/types";
import type { ItemRow } from "#/lib/api-types";
import { SERVER_ERRORS } from "#/lib/server-errors";
import { m } from "#/paraglide/messages";

import {
	card,
	drag,
	dragExpectingLive,
	installDragHarness,
	nameOf,
	startDrag,
} from "./dnd-test-harness";
import {
	inventoryRow,
	ring,
	stashRow,
	sword,
	wand,
} from "./item-test-fixtures";
import StashModal from "./StashModal";

type Props = Parameters<typeof StashModal>[0];

function fakeCalls() {
	return {
		onDeposit: vi.fn<Props["onDeposit"]>(async (ids) => ({
			deposited: ids.length,
			failed: 0,
		})),
		onWithdraw: vi.fn<Props["onWithdraw"]>(async (ids) => ({
			withdrawn: ids.length,
			failed: 0,
		})),
		onReorderInventory: vi.fn<Props["onReorderInventory"]>(),
		onReorderStash: vi.fn<Props["onReorderStash"]>(),
	};
}

type Setup = { isOpen?: boolean; inventory?: ItemRow[]; stash?: ItemRow[] };

function setup({ isOpen = true, inventory = [], stash = [] }: Setup = {}) {
	const calls = fakeCalls();
	const onClose = vi.fn<() => void>();
	const tree = (open: boolean) => (
		<>
			<StashModal
				isOpen={open}
				onClose={onClose}
				inventoryItems={inventory}
				stashItems={stash}
				{...calls}
			/>
			<Toaster />
		</>
	);
	const result = render(tree(isOpen));
	return {
		...result,
		...calls,
		onClose,
		close: () => result.rerender(tree(false)),
		open: () => result.rerender(tree(true)),
	};
}

function deferred<T>() {
	let resolve: (value: T) => void = () => {};
	const promise = new Promise<T>((r) => {
		resolve = r;
	});
	return { promise, resolve };
}

function dialog() {
	return screen.getAllByRole("dialog")[0];
}
function section(header: string) {
	return narrow(
		screen.getByText(header, { selector: "h3" }).closest("section"),
		HTMLElement,
	);
}
const inventorySection = () => section(m.stash_inventory_header());
const stashSection = () => section(m.stash_header());
function cells(panel: HTMLElement) {
	return [...narrow(panel.querySelector(".grid"), HTMLElement).children];
}
const invCell = (slot: number) =>
	narrow(cells(inventorySection())[slot], HTMLElement);
const stashCell = (slot: number) =>
	narrow(cells(stashSection())[slot], HTMLElement);
function dragSlotIn(cell: Element) {
	return narrow(cell.querySelector("button")?.parentElement, HTMLElement);
}
function button(name: string) {
	return screen.getByRole("button", { name });
}
const depositButton = () =>
	screen.getByRole("button", {
		name: new RegExp(`^${m.stash_deposit_selected()}`),
	});
const withdrawButton = () =>
	screen.getByRole("button", {
		name: new RegExp(`^${m.stash_withdraw_selected()}`),
	});

async function click(item: GeneratedItem, shiftKey = false) {
	await act(async () => {
		fireEvent.click(card(item), { shiftKey });
	});
}
async function press(el: HTMLElement) {
	await act(async () => {
		fireEvent.click(el);
	});
}

const SELECTED = "ring-sky-400/80";
const OVER = "ring-yellow-300/80";

installDragHarness();

describe("StashModal — open and close", () => {
	it("renders nothing while closed", () => {
		setup({ isOpen: false });
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("titles the dialog with the stash's used / total count", () => {
		setup({ stash: [stashRow(1, sword(), 0)] });
		expect(
			screen.getByText(m.stash_title({ used: 1, total: STASH_MAX_SLOTS })),
		).toBeTruthy();
	});

	it("closes from the footer button, the backdrop and Escape", () => {
		const t = setup();
		const closers = screen.getAllByRole("button", {
			name: m.modal_close_label(),
		});
		expect(closers).toHaveLength(2);
		for (const closer of closers) fireEvent.click(closer);
		expect(t.onClose).toHaveBeenCalledTimes(2);
		fireEvent.keyDown(document, { key: "Escape" });
		expect(t.onClose).toHaveBeenCalledTimes(3);
	});

	it("starts with nothing selected after a reopen", async () => {
		const s = sword();
		const t = setup({ inventory: [inventoryRow(1, s, 0)] });
		await click(s);
		expect(depositButton()).toBeTruthy();
		t.close();
		t.open();
		expect(
			screen.queryByRole("button", {
				name: new RegExp(`^${m.stash_deposit_selected()}`),
			}),
		).toBeNull();
		expect(invCell(0).className).not.toContain(SELECTED);
	});
});

describe("StashModal — the two grids", () => {
	it("draws every slot of both grids and puts each item in its own", () => {
		const s = sword();
		const r = ring();
		setup({
			inventory: [inventoryRow(1, s, 4)],
			stash: [stashRow(2, r, 9)],
		});
		expect(cells(inventorySection())).toHaveLength(INVENTORY_MAX_SLOTS);
		expect(cells(stashSection())).toHaveLength(STASH_MAX_SLOTS);
		expect(invCell(4).contains(card(s))).toBe(true);
		expect(stashCell(9).contains(card(r))).toBe(true);
	});

	it("counts the free slots of each side, singular at one", () => {
		const full = Array.from({ length: INVENTORY_MAX_SLOTS - 1 }, (_, i) =>
			inventoryRow(i + 1, sword(`Blade ${i}`), i),
		);
		setup({ inventory: full, stash: [stashRow(100, ring(), 0)] });
		expect(
			screen.getByText(m.inventory_free_slot_one({ count: 1 })),
		).toBeTruthy();
		expect(
			screen.getByText(m.stash_free_slot_other({ count: STASH_MAX_SLOTS - 1 })),
		).toBeTruthy();
	});

	it("shows the empty-stash message instead of the grid, until a drag starts", async () => {
		const s = sword();
		setup({ inventory: [inventoryRow(1, s, 0)] });
		expect(screen.getByText(m.stash_empty())).toBeTruthy();
		expect(stashSection().querySelector(".grid")).toBeNull();
		await startDrag(s);
		expect(screen.queryByText(m.stash_empty())).toBeNull();
		expect(cells(stashSection())).toHaveLength(STASH_MAX_SLOTS);
	});

	it("lays the slots out at their fixed stage size", () => {
		setup();
		expect(
			narrow(inventorySection().querySelector(".grid"), HTMLElement).style
				.gridTemplateColumns,
		).toBe("repeat(8, 76px)");
	});
});

describe("StashModal — selection", () => {
	it("toggles an item on click and rings its slot", async () => {
		const s = sword();
		setup({ inventory: [inventoryRow(1, s, 0)] });
		await click(s);
		expect(invCell(0).className).toContain(SELECTED);
		expect(depositButton().textContent).toContain("(1)");
		await click(s);
		expect(invCell(0).className).not.toContain(SELECTED);
		expect(
			screen.queryByRole("button", {
				name: new RegExp(`^${m.stash_deposit_selected()}`),
			}),
		).toBeNull();
	});

	it("selects and deselects a whole side, the toggle following the state", async () => {
		setup({
			inventory: [inventoryRow(1, sword(), 0), inventoryRow(2, ring(), 1)],
			stash: [stashRow(3, wand(), 0)],
		});
		const [invAll, stashAll] = screen.getAllByRole("button", {
			name: m.stash_select_all(),
		});
		await press(narrow(invAll, HTMLElement));
		expect(depositButton().textContent).toContain("(2)");
		expect(invCell(0).className).toContain(SELECTED);
		expect(invCell(1).className).toContain(SELECTED);
		await press(button(m.stash_deselect_all()));
		expect(invCell(0).className).not.toContain(SELECTED);

		await press(narrow(stashAll, HTMLElement));
		expect(withdrawButton().textContent).toContain("(1)");
	});

	it("hides a side's select-all toggle while that side is empty", () => {
		setup({ stash: [stashRow(1, sword(), 0)] });
		expect(
			screen.getAllByRole("button", { name: m.stash_select_all() }),
		).toHaveLength(1);
	});
});

describe("StashModal — bulk deposit and withdraw", () => {
	it("deposits the selection, in bag order, and clears it", async () => {
		const a = sword();
		const b = ring();
		const t = setup({
			inventory: [inventoryRow(1, a, 0), inventoryRow(2, b, 1)],
		});
		await click(b);
		await click(a);
		await press(depositButton());
		expect(t.onDeposit).toHaveBeenCalledWith([1, 2]);
		expect(invCell(0).className).not.toContain(SELECTED);
	});

	it("withdraws the selection and clears it", async () => {
		const a = sword();
		const t = setup({ stash: [stashRow(5, a, 0)] });
		await click(a);
		await press(withdrawButton());
		expect(t.onWithdraw).toHaveBeenCalledWith([5]);
		expect(stashCell(0).className).not.toContain(SELECTED);
	});

	it("reports a partial deposit and a partial withdraw", async () => {
		const a = sword();
		const b = ring();
		const t = setup({
			inventory: [inventoryRow(1, a, 0)],
			stash: [stashRow(2, b, 0)],
		});
		t.onDeposit.mockResolvedValue({ deposited: 0, failed: 1 });
		t.onWithdraw.mockResolvedValue({ withdrawn: 0, failed: 1 });
		await click(a);
		await press(depositButton());
		expect(
			await screen.findByText(
				m.stash_deposit_result({ deposited: 0, failed: 1 }),
			),
		).toBeTruthy();
		await click(b);
		await press(withdrawButton());
		expect(
			await screen.findByText(
				m.stash_withdraw_result({ withdrawn: 0, failed: 1 }),
			),
		).toBeTruthy();
	});

	it("disables the button while the call is in flight", async () => {
		const a = sword();
		const t = setup({
			inventory: [inventoryRow(1, a, 0), inventoryRow(2, ring(), 1)],
		});
		const pending = deferred<{ deposited: number; failed: number }>();
		t.onDeposit.mockReturnValue(pending.promise);
		await click(a);
		await press(depositButton());
		await click(a);
		const again = narrow(depositButton(), HTMLButtonElement);
		expect(again.disabled).toBe(true);
		await press(again);
		expect(t.onDeposit).toHaveBeenCalledTimes(1);
		await act(async () => {
			pending.resolve({ deposited: 1, failed: 0 });
		});
		expect(narrow(depositButton(), HTMLButtonElement).disabled).toBe(false);
	});

	it("puts the selection back and toasts a crash with the generic message", async () => {
		const a = sword();
		const t = setup({ inventory: [inventoryRow(1, a, 0)] });
		t.onDeposit.mockRejectedValue(new Error("boom"));
		await click(a);
		await press(depositButton());
		expect(await screen.findByText(m.error_deposit_failed())).toBeTruthy();
		expect(screen.queryByText("boom")).toBeNull();
		expect(invCell(0).className).toContain(SELECTED);
	});

	it("puts the withdraw selection back and translates a rule error", async () => {
		const a = sword();
		const t = setup({ stash: [stashRow(1, a, 0)] });
		t.onWithdraw.mockRejectedValue(ruleError(SERVER_ERRORS.characterNotFound));
		await click(a);
		await press(withdrawButton());
		expect(await screen.findByText(m.error_character_not_found())).toBeTruthy();
		expect(stashCell(0).className).toContain(SELECTED);
	});

	it("toasts the generic message, not 'full', for a failure with no message", async () => {
		const a = sword();
		const b = ring();
		const t = setup({
			inventory: [inventoryRow(1, a, 0)],
			stash: [stashRow(2, b, 0)],
		});
		t.onDeposit.mockRejectedValue("offline");
		t.onWithdraw.mockRejectedValue("offline");
		await click(a);
		await press(depositButton());
		expect(await screen.findByText(m.error_deposit_failed())).toBeTruthy();
		await click(b);
		await press(withdrawButton());
		expect(await screen.findByText(m.error_withdraw_failed())).toBeTruthy();
		expect(screen.queryByText(m.stash_full_error())).toBeNull();
	});
});

describe("StashModal — shift-click transfer", () => {
	it("deposits a bag item and withdraws a stash item, one at a time", async () => {
		const a = sword();
		const b = ring();
		const t = setup({
			inventory: [inventoryRow(1, a, 0)],
			stash: [stashRow(2, b, 0)],
		});
		await click(a, true);
		expect(t.onDeposit).toHaveBeenCalledWith([1]);
		await click(b, true);
		expect(t.onWithdraw).toHaveBeenCalledWith([2]);
		expect(invCell(0).className).not.toContain(SELECTED);
	});

	it("toasts a full stash and a full bag", async () => {
		const a = sword();
		const b = ring();
		const t = setup({
			inventory: [inventoryRow(1, a, 0)],
			stash: [stashRow(2, b, 0)],
		});
		t.onDeposit.mockResolvedValue({ deposited: 0, failed: 1 });
		t.onWithdraw.mockResolvedValue({ withdrawn: 0, failed: 1 });
		await click(a, true);
		expect(await screen.findByText(m.stash_full_error())).toBeTruthy();
		await click(b, true);
		expect(await screen.findByText(m.inventory_full_error())).toBeTruthy();
	});

	it("toasts a crash with the generic message", async () => {
		const a = sword();
		const t = setup({ inventory: [inventoryRow(1, a, 0)] });
		t.onDeposit.mockRejectedValue(new Error("boom"));
		await click(a, true);
		expect(await screen.findByText(m.error_deposit_failed())).toBeTruthy();
	});
});

describe("StashModal — drag inside a panel (reorder)", () => {
	it("moves a bag item onto an empty slot", async () => {
		const a = sword();
		const t = setup({ inventory: [inventoryRow(1, a, 0)] });
		await drag(a, invCell(5));
		expect(t.onReorderInventory).toHaveBeenCalledWith({
			itemId: 1,
			targetSlot: 5,
			swapWithItemId: undefined,
		});
	});

	it("swaps a bag item with the occupant of a full slot", async () => {
		const a = sword();
		const b = ring();
		const t = setup({
			inventory: [inventoryRow(1, a, 0), inventoryRow(2, b, 3)],
		});
		await drag(a, invCell(3));
		expect(t.onReorderInventory).toHaveBeenCalledWith({
			itemId: 1,
			targetSlot: 3,
			swapWithItemId: 2,
		});
	});

	it("moves and swaps inside the stash", async () => {
		const a = sword();
		const b = ring();
		const t = setup({ stash: [stashRow(1, a, 0), stashRow(2, b, 7)] });
		await drag(a, stashCell(7));
		expect(t.onReorderStash).toHaveBeenLastCalledWith({
			itemId: 1,
			targetSlot: 7,
			swapWithItemId: 2,
		});
		await drag(b, stashCell(12));
		expect(t.onReorderStash).toHaveBeenLastCalledWith({
			itemId: 2,
			targetSlot: 12,
			swapWithItemId: undefined,
		});
	});

	it("does nothing when dropped back on its own slot", async () => {
		const a = sword();
		const b = ring();
		const t = setup({
			inventory: [inventoryRow(1, a, 0)],
			stash: [stashRow(2, b, 0)],
		});
		await dragExpectingLive(a);
		await dragExpectingLive(b);
		expect(t.onReorderInventory).not.toHaveBeenCalled();
		expect(t.onReorderStash).not.toHaveBeenCalled();
	});
});

describe("StashModal — drag across panels (transfer)", () => {
	it("deposits a bag item dropped on the stash, whatever the slot", async () => {
		const a = sword();
		const t = setup({
			inventory: [inventoryRow(1, a, 0)],
			stash: [stashRow(2, ring(), 0)],
		});
		await drag(a, stashCell(30));
		expect(t.onDeposit).toHaveBeenCalledWith([1]);
		expect(t.onReorderStash).not.toHaveBeenCalled();
	});

	it("withdraws a stash item dropped on the bag", async () => {
		const b = ring();
		const t = setup({ stash: [stashRow(2, b, 0)] });
		await drag(b, invCell(10));
		expect(t.onWithdraw).toHaveBeenCalledWith([2]);
	});

	it("toasts a full stash, and a failed withdraw with its own message", async () => {
		const a = sword();
		const b = ring();
		const t = setup({
			inventory: [inventoryRow(1, a, 0)],
			stash: [stashRow(2, b, 0)],
		});
		t.onDeposit.mockResolvedValue({ deposited: 0, failed: 1 });
		t.onWithdraw.mockRejectedValue("offline");
		await drag(a, stashCell(5));
		expect(await screen.findByText(m.stash_full_error())).toBeTruthy();
		await drag(b, invCell(5));
		expect(await screen.findByText(m.error_withdraw_failed())).toBeTruthy();
	});

	it("translates a rule error on a failed transfer", async () => {
		const b = ring();
		const t = setup({ stash: [stashRow(2, b, 0)] });
		t.onWithdraw.mockRejectedValue(ruleError(SERVER_ERRORS.characterNotFound));
		await drag(b, invCell(5));
		expect(await screen.findByText(m.error_character_not_found())).toBeTruthy();
	});
});

describe("StashModal — drag feedback", () => {
	afterEach(resetViewport);

	it("hides the dragged card and rings the slot under the pointer", async () => {
		const a = sword();
		setup({
			inventory: [inventoryRow(1, a, 0)],
			stash: [stashRow(2, ring(), 0)],
		});
		await startDrag(a, stashCell(4));
		expect(dragSlotIn(invCell(0)).style.opacity).toBe("0");
		expect(stashCell(4).className).toContain(OVER);
		expect(screen.getAllByRole("button", { name: nameOf(a) })).toHaveLength(2);
	});

	it("inside the scaled stage, floats the dragged copy over it at the stage's scale", async () => {
		const a = sword();
		resizeViewport(960, 540);
		render(
			<GameStage>
				<StashModal
					isOpen
					onClose={vi.fn<() => void>()}
					inventoryItems={[inventoryRow(1, a, 0)]}
					stashItems={[stashRow(2, ring(), 0)]}
					{...fakeCalls()}
				/>
			</GameStage>,
		);
		await startDrag(a, stashCell(4));
		const copies = screen.getAllByRole("button", { name: nameOf(a) });
		const floating = copies.filter((b) => !stageElement().contains(b));
		expect(floating).toHaveLength(1);
		const scaled = narrow(floating[0]?.closest(".stage-scaled"), HTMLElement);
		expect(scaled.style.getPropertyValue("--stage-scale")).toBe("0.5");
	});

	it("drops the selection ring from the dragged item while it moves", async () => {
		const a = sword();
		setup({ inventory: [inventoryRow(1, a, 0)] });
		await click(a);
		expect(invCell(0).className).toContain(SELECTED);
		await startDrag(a, invCell(9));
		expect(invCell(0).className).not.toContain(SELECTED);
	});

	it("cancels on Escape without a call, and the stash stays open", async () => {
		const a = sword();
		const t = setup({ inventory: [inventoryRow(1, a, 0)] });
		await startDrag(a, invCell(9));
		await act(async () => {
			fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
		});
		expect(t.onReorderInventory).not.toHaveBeenCalled();
		expect(dragSlotIn(invCell(0)).style.opacity).toBe("1");
		expect(t.onClose).not.toHaveBeenCalled();
		expect(dialog()).toBeTruthy();
	});
});
