// The inventory modal's drag decisions: what a drop does, and how a
// paper-doll slot lights up while something is dragged. Pure, so the rules are
// tested without the DOM (drag.test.ts); the equip rules themselves stay in
// #/game/items/equipment and on the server.

import { validSlotsForItem } from "#/game/items/equipment";
import { type EquippedSlot, narrowEquippedSlot } from "#/game/stats/types";
import type { ItemRow } from "#/lib/api-types";

export type DropTargetData =
	| { kind: "inventory"; slot: number }
	| { kind: "equipment"; slot: EquippedSlot };

export type DragSourceData =
	| { kind: "inventory"; itemId: number }
	| { kind: "equipped"; slot: EquippedSlot; itemId: number };

/** The server call a drop makes. */
export type DropAction =
	| {
			kind: "reorder";
			itemId: number;
			targetSlot: number;
			swapWithItemId: number | undefined;
	  }
	| { kind: "equip"; itemId: number; targetSlot: EquippedSlot }
	// The bag slot is only a hint: the server places the item in the first
	// free slot.
	| { kind: "unequip"; slot: EquippedSlot }
	| { kind: "swapHands" };

function isHandPair(a: EquippedSlot, b: EquippedSlot): boolean {
	return (
		(a === "weapon" && b === "offhand") || (a === "offhand" && b === "weapon")
	);
}

/** What dropping `source` on `target` does, or `null` for a drop that does nothing. */
export function resolveDrop(
	source: DragSourceData,
	target: DropTargetData,
	inventory: readonly ItemRow[],
	handsSwappable: boolean,
): DropAction | null {
	if (source.kind === "equipped") {
		if (target.kind === "inventory") {
			return { kind: "unequip", slot: source.slot };
		}
		return isHandPair(source.slot, target.slot) && handsSwappable
			? { kind: "swapHands" }
			: null;
	}

	const sourceDoc = inventory.find((it) => it.id === source.itemId);
	if (!sourceDoc) return null;

	if (target.kind === "inventory") {
		if (sourceDoc.inventorySlot === target.slot) return null;
		const occupant = inventory.find(
			(it) => it.inventorySlot === target.slot && it.id !== source.itemId,
		);
		return {
			kind: "reorder",
			itemId: source.itemId,
			targetSlot: target.slot,
			swapWithItemId: occupant?.id,
		};
	}

	if (!validSlotsForItem(sourceDoc.data).includes(target.slot)) return null;
	return { kind: "equip", itemId: source.itemId, targetSlot: target.slot };
}

export type SlotHighlight = "strong" | "soft" | "invalid";

export const SLOT_HIGHLIGHT_CLASS = {
	strong: "ring-2 ring-yellow-300/90 shadow-[0_0_14px_rgba(253,224,71,0.55)]",
	soft: "ring-2 ring-yellow-300/40 shadow-[0_0_8px_rgba(253,224,71,0.25)]",
	invalid: "ring-2 ring-red-500/70",
} satisfies Record<SlotHighlight, string>;

function tier(isOver: boolean, accepts: boolean): SlotHighlight | null {
	if (isOver) return accepts ? "strong" : "invalid";
	return accepts ? "soft" : null;
}

/**
 * How paper-doll `slot` lights up while `dragging` is in flight: an inventory
 * item lights every slot it can go to (red when it hovers one it can't); an
 * equipped hand weapon lights the other hand when the hands can swap.
 */
export function slotHighlight({
	dragging,
	slot,
	isOver,
	eligible,
	handsSwappable,
}: {
	dragging: DragSourceData | null;
	slot: EquippedSlot;
	isOver: boolean;
	eligible: boolean;
	handsSwappable: boolean;
}): SlotHighlight | null {
	if (dragging?.kind === "inventory") return tier(isOver, eligible);
	if (dragging?.kind === "equipped" && isHandPair(dragging.slot, slot)) {
		return tier(isOver, handsSwappable);
	}
	return null;
}

// ── DnD payload narrowers ─────────────────────────────────────────────────
// @dnd-kit types `data.current` as Record<string, unknown> | undefined. Type
// guards (not parsers) keep the `unknown` boundary explicit, so a misregistered
// draggable can't coerce into a DragSourceData and crash a handler. `itemId` is
// only checked to be a number: every draggable here registers a real item id.

export function isDragSource(d: unknown): d is DragSourceData {
	if (typeof d !== "object" || d === null) return false;
	if (!("kind" in d) || !("itemId" in d)) return false;
	if (typeof d.itemId !== "number") return false;
	if (d.kind === "inventory") return true;
	return (
		d.kind === "equipped" &&
		"slot" in d &&
		typeof d.slot === "string" &&
		narrowEquippedSlot(d.slot) !== undefined
	);
}

export function isDropTarget(d: unknown): d is DropTargetData {
	if (typeof d !== "object" || d === null) return false;
	if (!("kind" in d) || !("slot" in d)) return false;
	if (d.kind === "inventory") return typeof d.slot === "number";
	return (
		d.kind === "equipment" &&
		typeof d.slot === "string" &&
		narrowEquippedSlot(d.slot) !== undefined
	);
}
