// @vitest-environment jsdom

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { narrow } from "#/components/dom-test-utils";
import type { GeneratedItem } from "#/game/items/types";
import { ConfirmationProvider } from "#/hooks/useConfirmationModal";
import type { BagEntry } from "#/lib/api-types";
import { m } from "#/paraglide/messages";

import { card } from "./dnd-test-harness";
import ExitZoneModal from "./ExitZoneModal";
import { bagEntry, helmet, ring, sword } from "./item-test-fixtures";

type Props = Parameters<typeof ExitZoneModal>[0];

afterEach(cleanup);

function fakeCalls() {
	return {
		onClose: vi.fn<Props["onClose"]>(),
		onPickSelected: vi.fn<Props["onPickSelected"]>(async () => {}),
		onDiscardSelected: vi.fn<Props["onDiscardSelected"]>(async () => {}),
		onPickAll: vi.fn<Props["onPickAll"]>(async () => {}),
		onDiscardAll: vi.fn<Props["onDiscardAll"]>(async () => {}),
	};
}

type Setup = { isOpen?: boolean; bag?: BagEntry[]; keepCap?: number };

function setup({ isOpen = true, bag = [], keepCap = 99 }: Setup = {}) {
	const calls = fakeCalls();
	let state = { isOpen, bag };
	const tree = () => (
		<ConfirmationProvider>
			<ExitZoneModal
				isOpen={state.isOpen}
				bagItems={state.bag}
				keepCap={keepCap}
				{...calls}
			/>
		</ConfirmationProvider>
	);
	const result = render(tree());
	const update = (next: Partial<typeof state>) => {
		state = { ...state, ...next };
		result.rerender(tree());
	};
	return { ...result, ...calls, update };
}

const s = sword();
const r = ring();
const h = helmet();
const BAG = [bagEntry("bag-s", s), bagEntry("bag-r", r), bagEntry("bag-h", h)];

const SELECTED = "ring-white";
const DIMMED = "opacity-40";

function button(name: string) {
	return narrow(screen.getByRole("button", { name }), HTMLButtonElement);
}
function closeButtons() {
	const names = new Set([m.loot_close_button(), m.modal_close_label()]);
	return [...names]
		.flatMap((name) => screen.getAllByRole("button", { name }))
		.map((b) => narrow(b, HTMLButtonElement));
}
const pickSelected = (count: number) =>
	button(m.loot_pick_selected_button({ count }));
const discardSelected = (count: number) =>
	button(m.loot_discard_selected_button({ count }));
const queryDiscardSelected = (count: number) =>
	screen.queryByRole("button", {
		name: m.loot_discard_selected_button({ count }),
	});
function lootDialog() {
	return screen.getAllByRole("dialog")[0];
}
const discardAll = () =>
	narrow(
		within(lootDialog()).getByRole("button", {
			name: m.loot_discard_all_button(),
		}),
		HTMLButtonElement,
	);
const pickAll = () => button(m.loot_pick_all_button());
const queryPickAll = () =>
	screen.queryByRole("button", { name: m.loot_pick_all_button() });
function confirmDialog() {
	const dialogs = screen.getAllByRole("dialog");
	expect(dialogs).toHaveLength(2);
	return dialogs[1];
}

async function press(el: HTMLElement) {
	await act(async () => {
		fireEvent.click(el);
	});
}
async function toggle(item: GeneratedItem) {
	await press(card(item));
}
async function answerConfirm(label: string) {
	await press(within(confirmDialog()).getByRole("button", { name: label }));
}

function deferred() {
	let resolve: () => void = () => {};
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

describe("ExitZoneModal — open and close", () => {
	it("renders nothing while closed", () => {
		setup({ isOpen: false, bag: BAG });
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("closes from the footer button, the header, the backdrop and Escape", () => {
		const t = setup({ bag: BAG });
		const closers = closeButtons();
		expect(closers).toHaveLength(3);
		for (const closer of closers) fireEvent.click(closer);
		expect(t.onClose).toHaveBeenCalledTimes(3);
		fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
		expect(t.onClose).toHaveBeenCalledTimes(4);
	});

	it("says the run dropped nothing and disables every action on an empty bag", () => {
		setup();
		expect(screen.getByText(m.loot_bag_empty_run())).toBeTruthy();
		expect(pickSelected(0).disabled).toBe(true);
		expect(discardAll().disabled).toBe(true);
		expect(pickAll().disabled).toBe(true);
		expect(closeButtons().every((b) => !b.disabled)).toBe(true);
	});

	it("starts with nothing selected after a reopen", async () => {
		const t = setup({ bag: BAG });
		await toggle(s);
		expect(pickSelected(1)).toBeTruthy();
		t.update({ isOpen: false });
		t.update({ isOpen: true });
		expect(pickSelected(0).disabled).toBe(true);
		expect(card(s).className).not.toContain(SELECTED);
	});
});

describe("ExitZoneModal — selection", () => {
	it("shows every bag item and toggles one on click", async () => {
		setup({ bag: BAG });
		for (const item of [s, r, h]) expect(card(item)).toBeTruthy();
		expect(pickSelected(0).disabled).toBe(true);
		await toggle(r);
		expect(card(r).className).toContain(SELECTED);
		expect(pickSelected(1).disabled).toBe(false);
		await toggle(r);
		expect(card(r).className).not.toContain(SELECTED);
		expect(pickSelected(0).disabled).toBe(true);
	});

	it("drops a selected item that left the bag", async () => {
		const t = setup({ bag: BAG });
		await toggle(s);
		await toggle(r);
		expect(pickSelected(2)).toBeTruthy();
		t.update({ bag: [BAG[1], BAG[2]] });
		await press(pickSelected(1));
		expect(t.onPickSelected).toHaveBeenCalledExactlyOnceWith(["bag-r"]);
	});
});

describe("ExitZoneModal — camp exit (no cap)", () => {
	it("keeps the selected items, in bag order", async () => {
		const t = setup({ bag: BAG });
		await toggle(h);
		await toggle(s);
		await press(pickSelected(2));
		expect(t.onPickSelected).toHaveBeenCalledExactlyOnceWith([
			"bag-s",
			"bag-h",
		]);
	});

	it("keeps the whole bag with pick all", async () => {
		const t = setup({ bag: BAG });
		await press(pickAll());
		expect(t.onPickAll).toHaveBeenCalledExactlyOnceWith([
			"bag-s",
			"bag-r",
			"bag-h",
		]);
	});

	it("discards the selected items only after confirming", async () => {
		const t = setup({ bag: BAG });
		await toggle(r);
		await press(discardSelected(1));
		expect(
			within(confirmDialog()).getByText(
				m.loot_discard_message_one({ count: 1 }),
			),
		).toBeTruthy();
		expect(t.onDiscardSelected).not.toHaveBeenCalled();
		await answerConfirm(m.loot_discard_confirm_button());
		expect(t.onDiscardSelected).toHaveBeenCalledExactlyOnceWith(["bag-r"]);
	});

	it("keeps the selection when the discard is backed out of", async () => {
		const t = setup({ bag: BAG });
		await toggle(r);
		await press(discardSelected(1));
		await answerConfirm(m.loot_back_button());
		expect(t.onDiscardSelected).not.toHaveBeenCalled();
		expect(screen.getAllByRole("dialog")).toHaveLength(1);
		expect(card(r).className).toContain(SELECTED);
	});

	it("discards the whole bag after confirming, counting it in the message", async () => {
		const t = setup({ bag: BAG });
		await press(discardAll());
		expect(
			within(confirmDialog()).getByText(
				m.loot_discard_message_other({ count: 3 }),
			),
		).toBeTruthy();
		await answerConfirm(m.loot_discard_confirm_button());
		expect(t.onDiscardAll).toHaveBeenCalledOnce();
	});

	it("leaves the bag alone when discard all is backed out of", async () => {
		const t = setup({ bag: BAG });
		await press(discardAll());
		await answerConfirm(m.loot_back_button());
		expect(t.onDiscardAll).not.toHaveBeenCalled();
		expect(t.onClose).not.toHaveBeenCalled();
	});
});

describe("ExitZoneModal — non-camp exit (keep cap)", () => {
	it("hints the cap and hides the bulk keep and the selective discard", async () => {
		setup({ bag: BAG, keepCap: 2 });
		expect(
			screen.getByText(m.loot_keep_cap_hint({ selected: 0, cap: 2 })),
		).toBeTruthy();
		expect(queryPickAll()).toBeNull();
		await toggle(s);
		expect(queryDiscardSelected(1)).toBeNull();
		expect(
			screen.getByText(m.loot_keep_cap_hint({ selected: 1, cap: 2 })),
		).toBeTruthy();
	});

	it("shows no cap hint when the whole bag fits", () => {
		setup({ bag: BAG, keepCap: 3 });
		expect(
			screen.queryByText(m.loot_keep_cap_hint({ selected: 0, cap: 3 })),
		).toBeNull();
		expect(queryPickAll()).toBeTruthy();
	});

	it("stops selecting at the cap and dims the rest until one is freed", async () => {
		const t = setup({ bag: BAG, keepCap: 2 });
		await toggle(s);
		await toggle(r);
		expect(card(h).className).toContain(DIMMED);
		expect(card(s).className).not.toContain(DIMMED);
		await toggle(h);
		expect(card(h).className).not.toContain(SELECTED);
		expect(pickSelected(2)).toBeTruthy();
		await toggle(s);
		expect(card(h).className).not.toContain(DIMMED);
		await toggle(h);
		await press(pickSelected(2));
		expect(t.onPickSelected).toHaveBeenCalledExactlyOnceWith([
			"bag-r",
			"bag-h",
		]);
	});
});

describe("ExitZoneModal — while an action is in flight", () => {
	it("disables every action until it settles, and sends it once", async () => {
		const t = setup({ bag: BAG });
		const pending = deferred();
		t.onPickAll.mockReturnValue(pending.promise);
		await press(pickAll());
		expect(pickAll().disabled).toBe(true);
		expect(discardAll().disabled).toBe(true);
		await toggle(s);
		expect(pickSelected(1).disabled).toBe(true);
		expect(discardSelected(1).disabled).toBe(true);
		expect(closeButtons().every((b) => !b.disabled)).toBe(true);
		await press(pickAll());
		expect(t.onPickAll).toHaveBeenCalledOnce();
		await act(async () => {
			pending.resolve();
		});
		expect(pickAll().disabled).toBe(false);
		expect(pickSelected(1).disabled).toBe(false);
	});
});
