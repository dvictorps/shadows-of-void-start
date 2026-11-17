import type { ItemRow } from "#/lib/api-types";

import type { SlotMove } from "../reorder-or-toast";

export type StashSide = "inventory" | "stash";

export const DROP_ID_PREFIX = {
	inventory: "inv",
	stash: "stash",
} as const satisfies Record<StashSide, string>;

export type DropTargetData = { kind: StashSide; slot: number };
export type DragSourceData = { kind: StashSide; itemId: number };

export type StashMove = SlotMove;

export type StashDropAction =
	| { kind: "reorderInventory"; move: StashMove }
	| { kind: "reorderStash"; move: StashMove }
	| { kind: "deposit"; itemId: number }
	| { kind: "withdraw"; itemId: number };

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
