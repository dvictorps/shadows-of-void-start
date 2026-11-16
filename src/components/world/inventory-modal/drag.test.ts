import { describe, expect, it } from "vitest";

import type { EquippedSlot } from "#/game/stats/types";

import {
	greatsword,
	helmet,
	inventoryRow,
	ring,
	sword,
} from "../item-test-fixtures";
import {
	type DragSourceData,
	type DropTargetData,
	isDragSource,
	isDropTarget,
	resolveDrop,
	slotHighlight,
} from "./drag";

const s = sword();
const r = ring();
const INVENTORY = [inventoryRow(1, s, 0), inventoryRow(2, r, 3)];

const fromBag = (itemId: number): DragSourceData => ({
	kind: "inventory",
	itemId,
});
const fromDoll = (slot: EquippedSlot, itemId = 9): DragSourceData => ({
	kind: "equipped",
	slot,
	itemId,
});
const toBag = (slot: number): DropTargetData => ({ kind: "inventory", slot });
const toDoll = (slot: EquippedSlot): DropTargetData => ({
	kind: "equipment",
	slot,
});

describe("resolveDrop", () => {
	it("moves a bag item onto an empty slot, with no swap partner", () => {
		expect(resolveDrop(fromBag(1), toBag(5), INVENTORY, false)).toEqual({
			kind: "reorder",
			itemId: 1,
			targetSlot: 5,
			swapWithItemId: undefined,
		});
	});

	it("swaps with the occupant of a full slot", () => {
		expect(resolveDrop(fromBag(1), toBag(3), INVENTORY, false)).toEqual({
			kind: "reorder",
			itemId: 1,
			targetSlot: 3,
			swapWithItemId: 2,
		});
	});

	it("does nothing on the item's own slot, or for an item not in the bag", () => {
		expect(resolveDrop(fromBag(1), toBag(0), INVENTORY, false)).toBeNull();
		expect(resolveDrop(fromBag(99), toBag(5), INVENTORY, false)).toBeNull();
		expect(resolveDrop(fromBag(99), toDoll("weapon"), INVENTORY, false)).toBe(
			null,
		);
	});

	it("equips on a slot the item fits, and ignores one it doesn't", () => {
		expect(resolveDrop(fromBag(2), toDoll("ring2"), INVENTORY, false)).toEqual({
			kind: "equip",
			itemId: 2,
			targetSlot: "ring2",
		});
		const twoHanded = [inventoryRow(1, greatsword(), 0)];
		expect(
			resolveDrop(fromBag(1), toDoll("offhand"), twoHanded, false),
		).toBeNull();
		const helm = [inventoryRow(1, helmet(), 0)];
		expect(resolveDrop(fromBag(1), toDoll("boots"), helm, false)).toBeNull();
	});

	it("unequips an equipped item dropped anywhere in the bag", () => {
		expect(
			resolveDrop(fromDoll("helmet"), toBag(40), INVENTORY, false),
		).toEqual({ kind: "unequip", slot: "helmet" });
	});

	it("swaps hands across the hand pair only when the hands can swap", () => {
		const swap = { kind: "swapHands" };
		expect(
			resolveDrop(fromDoll("weapon"), toDoll("offhand"), INVENTORY, true),
		).toEqual(swap);
		expect(
			resolveDrop(fromDoll("offhand"), toDoll("weapon"), INVENTORY, true),
		).toEqual(swap);
		expect(
			resolveDrop(fromDoll("weapon"), toDoll("offhand"), INVENTORY, false),
		).toBeNull();
		expect(
			resolveDrop(fromDoll("helmet"), toDoll("amulet"), INVENTORY, true),
		).toBeNull();
	});
});

describe("dnd payload narrowers", () => {
	it("accept the payloads the modal registers", () => {
		expect(isDragSource(fromBag(1))).toBe(true);
		expect(isDragSource(fromDoll("ring1"))).toBe(true);
		expect(isDropTarget(toBag(0))).toBe(true);
		expect(isDropTarget(toDoll("offhand"))).toBe(true);
	});

	it("reject anything else", () => {
		expect(isDragSource(null)).toBe(false);
		expect(isDragSource({ kind: "inventory", itemId: "1" })).toBe(false);
		expect(isDragSource({ kind: "equipped", slot: "tail", itemId: 1 })).toBe(
			false,
		);
		expect(isDropTarget(null)).toBe(false);
		expect(isDropTarget({ kind: "inventory", slot: "3" })).toBe(false);
		expect(isDropTarget({ kind: "equipment", slot: "tail" })).toBe(false);
	});
});

describe("slotHighlight", () => {
	const bagItem: DragSourceData = { kind: "inventory", itemId: 1 };
	const base = {
		slot: "helmet" as const,
		isOver: false,
		eligible: false,
		handsSwappable: false,
	};

	it("is off with nothing dragged", () => {
		expect(slotHighlight({ ...base, dragging: null, isOver: true })).toBeNull();
	});

	it("lights a bag item's slots: soft, strong under the pointer, red when it can't go there", () => {
		const drag = { ...base, dragging: bagItem };
		expect(slotHighlight({ ...drag, eligible: true })).toBe("soft");
		expect(slotHighlight({ ...drag, eligible: true, isOver: true })).toBe(
			"strong",
		);
		expect(slotHighlight({ ...drag, isOver: true })).toBe("invalid");
		expect(slotHighlight(drag)).toBeNull();
	});

	it("lights the other hand for an equipped hand weapon, by whether the hands swap", () => {
		const drag = {
			...base,
			slot: "offhand" as const,
			dragging: { kind: "equipped", slot: "weapon", itemId: 9 } as const,
		};
		expect(slotHighlight({ ...drag, handsSwappable: true })).toBe("soft");
		expect(slotHighlight({ ...drag, handsSwappable: true, isOver: true })).toBe(
			"strong",
		);
		expect(slotHighlight({ ...drag, isOver: true })).toBe("invalid");
		expect(slotHighlight(drag)).toBeNull();
	});

	it("leaves every other slot dark for an equipped item", () => {
		const fromHelmet: DragSourceData = {
			kind: "equipped",
			slot: "helmet",
			itemId: 9,
		};
		expect(
			slotHighlight({
				...base,
				dragging: fromHelmet,
				isOver: true,
				handsSwappable: true,
			}),
		).toBeNull();
		const fromWeapon: DragSourceData = {
			kind: "equipped",
			slot: "weapon",
			itemId: 9,
		};
		expect(
			slotHighlight({
				...base,
				slot: "weapon",
				dragging: fromWeapon,
				isOver: true,
			}),
		).toBeNull();
	});
});
