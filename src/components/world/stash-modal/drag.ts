// The stash modal's drag decisions: what a drop does. Pure, so the rules are
// tested without the DOM (drag.test.ts).

import type { ItemRow } from "#/lib/api-types";

import type { SlotMove } from "../reorder-or-toast";

/** A grid of the stash modal: the character's bag or the account stash. */
export type StashSide = "inventory" | "stash";

/** The droppable id prefix per side (`inv-3`, `stash-3`). */
export const DROP_ID_PREFIX = {
	inventory: "inv",
	stash: "stash",
} as const satisfies Record<StashSide, string>;

export type DropTargetData = { kind: StashSide; slot: number };
export type DragSourceData = { kind: StashSide; itemId: number };

export type StashMove = SlotMove;

/** The call a drop makes. */
export type StashDropAction =
	| { kind: "reorderInventory"; move: StashMove }
	| { kind: "reorderStash"; move: StashMove }
	// The target slot is only a hint: the server places the item in the first
	// free slot of the other side.
	| { kind: "deposit"; itemId: number }
	| { kind: "withdraw"; itemId: number };

/** The item's slot on `side`'s grid. */
export const slotOf = (item: ItemRow, side: StashSide) =>
	side === "inventory" ? item.inventorySlot : item.stashSlot;

function reorder(
	source: DragSourceData,
	targetSlot: number,
	items: readonly ItemRow[],
): StashMove | null {
	const doc = items.find((it) => it.id === source.itemId);
	if (!doc || slotOf(doc, source.kind) === targetSlot) return null;
	const occupant = items.find(
		(it) => slotOf(it, source.kind) === targetSlot && it.id !== source.itemId,
	);
	return { itemId: source.itemId, targetSlot, swapWithItemId: occupant?.id };
}

/** What dropping `source` on `target` does, or `null` for a drop that does nothing. */
export function resolveStashDrop(
	source: DragSourceData,
	target: DropTargetData,
	inventory: readonly ItemRow[],
	stash: readonly ItemRow[],
): StashDropAction | null {
	if (source.kind !== target.kind) {
		return source.kind === "inventory"
			? { kind: "deposit", itemId: source.itemId }
			: { kind: "withdraw", itemId: source.itemId };
	}
	if (source.kind === "inventory") {
		const move = reorder(source, target.slot, inventory);
		return move && { kind: "reorderInventory", move };
	}
	const move = reorder(source, target.slot, stash);
	return move && { kind: "reorderStash", move };
}

// @dnd-kit types `data.current` as an open record; these guards are the
// `unknown` boundary. `itemId` is only checked to be a number: every
// draggable here registers a real item id.

const isSide = (k: unknown): k is StashSide =>
	k === "inventory" || k === "stash";

export function isDragSource(d: unknown): d is DragSourceData {
	if (typeof d !== "object" || d === null) return false;
	if (!("kind" in d) || !("itemId" in d)) return false;
	return isSide(d.kind) && typeof d.itemId === "number";
}

export function isDropTarget(d: unknown): d is DropTargetData {
	if (typeof d !== "object" || d === null) return false;
	if (!("kind" in d) || !("slot" in d)) return false;
	return isSide(d.kind) && typeof d.slot === "number";
}
