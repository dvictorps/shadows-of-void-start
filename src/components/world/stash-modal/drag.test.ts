import { describe, expect, it } from "vitest";

import { inventoryRow, ring, stashRow, sword } from "../item-test-fixtures";
import { isDragSource, isDropTarget, resolveStashDrop } from "./drag";

const INVENTORY = [inventoryRow(1, sword(), 0), inventoryRow(2, ring(), 3)];
const STASH = [stashRow(10, sword(), 0), stashRow(11, ring(), 5)];

const resolve = (
	source: { kind: "inventory" | "stash"; itemId: number },
	target: { kind: "inventory" | "stash"; slot: number },
) => resolveStashDrop(source, target, INVENTORY, STASH);

describe("resolveStashDrop", () => {
	it("reorders the bag onto an empty slot or swaps with the occupant", () => {
		expect(
			resolve({ kind: "inventory", itemId: 1 }, { kind: "inventory", slot: 7 }),
		).toEqual({
			kind: "reorderInventory",
			move: { itemId: 1, targetSlot: 7, swapWithItemId: undefined },
		});
		expect(
			resolve({ kind: "inventory", itemId: 1 }, { kind: "inventory", slot: 3 }),
		).toEqual({
			kind: "reorderInventory",
			move: { itemId: 1, targetSlot: 3, swapWithItemId: 2 },
		});
	});

	it("reorders the stash by its own slots", () => {
		expect(
			resolve({ kind: "stash", itemId: 10 }, { kind: "stash", slot: 5 }),
		).toEqual({
			kind: "reorderStash",
			move: { itemId: 10, targetSlot: 5, swapWithItemId: 11 },
		});
	});

	it("does nothing on the item's own slot, or for an item it doesn't know", () => {
		expect(
			resolve({ kind: "inventory", itemId: 2 }, { kind: "inventory", slot: 3 }),
		).toBeNull();
		expect(
			resolve({ kind: "stash", itemId: 11 }, { kind: "stash", slot: 5 }),
		).toBeNull();
		expect(
			resolve({ kind: "stash", itemId: 99 }, { kind: "stash", slot: 1 }),
		).toBeNull();
	});

	it("transfers across panels, whatever the target slot", () => {
		expect(
			resolve({ kind: "inventory", itemId: 1 }, { kind: "stash", slot: 40 }),
		).toEqual({ kind: "deposit", itemId: 1 });
		expect(
			resolve({ kind: "stash", itemId: 10 }, { kind: "inventory", slot: 0 }),
		).toEqual({ kind: "withdraw", itemId: 10 });
	});
});

describe("the dnd-kit payload guards", () => {
	it("accept the stash modal's payloads", () => {
		expect(isDragSource({ kind: "stash", itemId: 1 })).toBe(true);
		expect(isDropTarget({ kind: "inventory", slot: 0 })).toBe(true);
	});

	it("reject anything else", () => {
		expect(isDragSource(null)).toBe(false);
		expect(isDragSource({ kind: "equipped", itemId: 1 })).toBe(false);
		expect(isDragSource({ kind: "stash", itemId: "1" })).toBe(false);
		expect(isDropTarget({ kind: "stash" })).toBe(false);
		expect(isDropTarget({ kind: "equipment", slot: 0 })).toBe(false);
	});
});
