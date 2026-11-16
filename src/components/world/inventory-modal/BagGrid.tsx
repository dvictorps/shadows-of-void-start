import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useMemo } from "react";

import ItemCard, { SLOT_EMPTY } from "#/components/game/ItemCard";
import { INVENTORY_MAX_SLOTS } from "#/game/inventory/constants";
import type { ItemRow } from "#/lib/api-types";
import { m } from "#/paraglide/messages";

import type { DragSourceData, DropTargetData } from "./drag";
import DragSlot from "./DragSlot";

export const INVENTORY_SLOT_SIZE = 112;
const INVENTORY_COLUMNS = 8;

/** The bag: the free-slot count and the bag grid, each slot a drop target. */
export default function BagGrid({
	inventory,
	dragging,
	avoidRect,
	onItemClick,
}: {
	inventory: readonly ItemRow[];
	dragging: DragSourceData | null;
	avoidRect: DOMRect | null;
	onItemClick: (source: DragSourceData, rect: DOMRect) => void;
}) {
	const inventoryBySlot = useMemo(() => {
		const map = new Map<number, ItemRow>();
		for (const item of inventory) {
			if (item.inventorySlot !== null) map.set(item.inventorySlot, item);
		}
		return map;
	}, [inventory]);

	const freeSlots = Math.max(0, INVENTORY_MAX_SLOTS - inventory.length);

	return (
		<section className="min-w-0 flex-1">
			<div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-white/40">
				<h3>{m.inventory_bag_header()}</h3>
				<span>
					{freeSlots === 1
						? m.inventory_free_slot_one({ count: freeSlots })
						: m.inventory_free_slot_other({ count: freeSlots })}
				</span>
			</div>
			<div className="fancy-scroll max-h-[60vh] overflow-y-auto pr-3">
				<div
					className="grid gap-2"
					style={{
						gridTemplateColumns: `repeat(${INVENTORY_COLUMNS}, ${INVENTORY_SLOT_SIZE}px)`,
					}}
				>
					{Array.from({ length: INVENTORY_MAX_SLOTS }, (_, slot) => {
						const item = inventoryBySlot.get(slot) ?? null;
						return (
							<InventoryDroppable
								key={`slot-${slot}`}
								slot={slot}
								item={item}
								isDraggingThis={
									dragging?.kind === "inventory" && item?.id === dragging.itemId
								}
								avoidRect={avoidRect}
								onItemClick={onItemClick}
							/>
						);
					})}
				</div>
			</div>
		</section>
	);
}

function InventoryDroppable({
	slot,
	item,
	isDraggingThis,
	avoidRect,
	onItemClick,
}: {
	slot: number;
	item: ItemRow | null;
	isDraggingThis: boolean;
	avoidRect: DOMRect | null;
	onItemClick: (source: DragSourceData, rect: DOMRect) => void;
}) {
	const { setNodeRef, isOver } = useDroppable({
		id: `slot-${slot}`,
		data: { kind: "inventory", slot } satisfies DropTargetData,
	});
	const highlight = isOver ? "ring-2 ring-yellow-300/80" : "";
	return (
		<div
			ref={setNodeRef}
			style={{ width: INVENTORY_SLOT_SIZE, height: INVENTORY_SLOT_SIZE }}
			className={`relative rounded-md transition-shadow ${highlight}`}
		>
			<div className={`absolute inset-0 rounded-md ${SLOT_EMPTY}`} />
			{item && (
				<DraggableInventoryItem
					item={item}
					hidden={isDraggingThis}
					avoidRect={avoidRect}
					onClick={onItemClick}
				/>
			)}
		</div>
	);
}

function DraggableInventoryItem({
	item,
	hidden,
	avoidRect,
	onClick,
}: {
	item: ItemRow;
	hidden: boolean;
	avoidRect: DOMRect | null;
	onClick: (source: DragSourceData, rect: DOMRect) => void;
}) {
	const handle = useDraggable({
		id: item.id,
		data: { kind: "inventory", itemId: item.id } satisfies DragSourceData,
	});
	return (
		<DragSlot handle={handle} hidden={hidden}>
			<ItemCard
				item={item.data}
				size={INVENTORY_SLOT_SIZE}
				suppressTooltip={hidden}
				avoidRect={avoidRect}
				onClick={
					hidden
						? undefined
						: (rect) => onClick({ kind: "inventory", itemId: item.id }, rect)
				}
			/>
		</DragSlot>
	);
}
