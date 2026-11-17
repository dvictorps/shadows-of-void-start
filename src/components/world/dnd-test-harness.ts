import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { toast } from "sonner";
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from "vitest";

import { translateItemName } from "#/game/items/item-name";
import type { GeneratedItem } from "#/game/items/types";

export const nameOf = (item: GeneratedItem) => translateItemName(item);

export function card(item: GeneratedItem) {
	return screen.getByRole("button", { name: nameOf(item) });
}

const DND_CLICK_GUARD_MS = 60;
const SIZE = 100;
const TARGET_X = 1000;
const FAR = 50_000;

let draggedName: string | null = null;
let target: Element | null = null;
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

export async function dragExpectingLive(item: GeneratedItem, over?: Element) {
	const drop = await startDrag(item, over);
	expect(screen.getAllByRole("button", { name: nameOf(item) })).toHaveLength(2);
	await drop();
}

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
