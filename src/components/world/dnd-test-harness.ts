// The dnd-kit drag harness shared by the item-modal component tests
// (InventoryModal, StashModal). Drag runs through dnd-kit's real
// PointerSensor. jsdom lays nothing out, so `getBoundingClientRect` is
// stubbed: the dragged item (its cell, its draggable, the drag overlay) sits
// at the origin, the drop target the test names sits 1000 px to the right,
// everything else far away. A drag moves the pointer by that offset, so
// `closestCenter` lands on the target. jsdom has no `Element.animate`, which
// the overlay's drop animation calls; a stub finishes it at once.

import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { toast } from "sonner";
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from "vitest";

import { translateItemName } from "#/game/items/item-name";
import type { GeneratedItem } from "#/game/items/types";

export const nameOf = (item: GeneratedItem) => translateItemName(item);

/** The item's card (ItemCard renders a button named after the item). */
export function card(item: GeneratedItem) {
	return screen.getByRole("button", { name: nameOf(item) });
}

const DND_CLICK_GUARD_MS = 60;
const SIZE = 100;
const TARGET_X = 1000;
const FAR = 50_000;

let draggedName: string | null = null;
let target: Element | null = null;
// A drag a test left in flight; the harness drops it before the next test.
let inFlight: (() => Promise<void>) | null = null;

function rectAt(x: number, y: number): DOMRect {
	return new DOMRect(x, y, SIZE, SIZE);
}

function holdsDragged(el: Element): boolean {
	if (draggedName === null) return false;
	const name = draggedName;
	const labelled = (b: Element) => b.getAttribute("aria-label") === name;
	return labelled(el) || [...el.querySelectorAll("button")].some(labelled);
}

function layout(el: Element): DOMRect {
	if (target && target.contains(el)) return rectAt(TARGET_X, 0);
	if (holdsDragged(el)) return rectAt(0, 0);
	return rectAt(FAR, FAR);
}

/**
 * Presses on `item`'s card and moves onto `over` (or back onto its own cell
 * when `over` is omitted), leaving the drag in flight. Returns the drop.
 */
export async function startDrag(item: GeneratedItem, over?: Element) {
	draggedName = nameOf(item);
	target = over ?? null;
	const dx = over ? TARGET_X : 0;
	fireEvent.pointerDown(card(item), {
		isPrimary: true,
		button: 0,
		clientX: 50,
		clientY: 50,
	});
	await act(async () => {
		fireEvent.pointerMove(document, { clientX: 60, clientY: 50 });
	});
	await act(async () => {
		fireEvent.pointerMove(document, { clientX: 50 + dx, clientY: 50 });
	});
	const drop = async () => {
		inFlight = null;
		await act(async () => {
			fireEvent.pointerUp(document, { clientX: 50 + dx, clientY: 50 });
		});
	};
	inFlight = drop;
	return drop;
}

export async function drag(item: GeneratedItem, over?: Element) {
	const drop = await startDrag(item, over);
	await drop();
}

/**
 * A drag that must end in no call: proves the drag is live (the overlay holds
 * a second copy of the card) before dropping, so the test can't pass because
 * the drag never started.
 */
export async function dragExpectingLive(item: GeneratedItem, over?: Element) {
	const drop = await startDrag(item, over);
	expect(screen.getAllByRole("button", { name: nameOf(item) })).toHaveLength(2);
	await drop();
}

/** An animation that is over as soon as dnd-kit listens for its end. */
class FinishedAnimation {
	#onfinish: (() => void) | null = null;
	get onfinish() {
		return this.#onfinish;
	}
	set onfinish(done: (() => void) | null) {
		this.#onfinish = done;
		done?.();
	}
}

/**
 * Installs the layout stub, the `animate` stub and the per-test cleanup
 * (Testing Library's `cleanup`, sonner's toasts, the mocks). Call once at the
 * top level of the test file.
 */
export function installDragHarness() {
	beforeAll(() => {
		Object.defineProperty(HTMLElement.prototype, "animate", {
			configurable: true,
			value: () => new FinishedAnimation(),
		});
	});

	afterAll(() => {
		Reflect.deleteProperty(HTMLElement.prototype, "animate");
	});

	beforeEach(() => {
		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
			function (this: HTMLElement) {
				return layout(this);
			},
		);
	});

	afterEach(async () => {
		await inFlight?.();
		// After a drop, dnd-kit swallows clicks on `document` for 50 ms; wait it
		// out so the next test's first click lands.
		await new Promise<void>((done) => {
			setTimeout(done, DND_CLICK_GUARD_MS);
		});
		cleanup();
		toast.dismiss();
		vi.restoreAllMocks();
		draggedName = null;
		target = null;
	});
}
