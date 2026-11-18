import { useDraggable } from "@dnd-kit/core";
import { useMemo } from "react";

import DragSlot from "#/components/game/DragSlot";
import DropCell from "#/components/game/DropCell";
import ItemCard from "#/components/game/ItemCard";
import { Button } from "#/components/ui/button";
import type { ItemRow } from "#/lib/api-types";
import { m } from "#/paraglide/messages";

import { allSelected } from "../item-selection";
import {
	DROP_ID_PREFIX,
	type DragSourceData,
	type DropTargetData,
	slotOf,
	type StashSide,
} from "./drag";

const COLUMNS = 8;
const SELECTED_RING = "ring-2 ring-sky-400/80";

export default function StashPanel({
	side,
	header,
	freeLabel,
	emptyLabel,
	items,
	maxSlots,
	selected,
	dragging,
	slotSize,
	onToggleAll,
	onItemClick,
}: {
	side: StashSide;
	header: string;
	freeLabel: (freeSlots: number) => string;
	emptyLabel?: string;
	items: readonly ItemRow[];
	maxSlots: number;
	selected: ReadonlySet<number>;
	dragging: DragSourceData | null;
	slotSize: number;
	onToggleAll: () => void;
	onItemClick: (itemId: number, shiftKey: boolean) => void;
}) {
	const bySlot = useMemo(() => {
		const map = new Map<number, ItemRow>();
		for (const item of items) {
			const slot = slotOf(item, side);
			if (slot !== null) map.set(slot, item);
		}
		return map;
	}, [items, side]);

	const showEmpty = emptyLabel !== undefined && items.length === 0 && !dragging;

	return (
		<section className="min-w-0 flex-1">
			<div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-white/40">
				<h3>{header}</h3>
				<div className="flex items-center gap-3">
					{items.length > 0 && (
						<Button
							type="button"
							variant="starkText"
							size="inline"
							onClick={onToggleAll}
							className="text-[10px] font-normal"
						>
							{allSelected(selected, items)
								? m.stash_deselect_all()
								: m.stash_select_all()}
						</Button>
					)}
					<span>{freeLabel(Math.max(0, maxSlots - items.length))}</span>
				</div>
			</div>
			<div className="fancy-scroll max-h-162 overflow-y-auto pr-2">
				{showEmpty ? (
					<p className="py-12 text-center text-sm text-white/40">
						{emptyLabel}
					</p>
				) : (
					<div
						className="grid gap-1"
						style={{ gridTemplateColumns: `repeat(${COLUMNS}, ${slotSize}px)` }}
					>
						{Array.from({ length: maxSlots }, (_, slot) => {
							const item = bySlot.get(slot) ?? null;
							const isDraggingThis =
								dragging?.kind === side && item?.id === dragging.itemId;
							const isSelected =
								item !== null && selected.has(item.id) && !isDraggingThis;
							return (
								<DropCell
									key={slot}
									id={`${DROP_ID_PREFIX[side]}-${slot}`}
									data={{ kind: side, slot } satisfies DropTargetData}
									size={slotSize}
									idleRing={isSelected ? SELECTED_RING : undefined}
								>
									{item && (
										<DraggableItem
											item={item}
											side={side}
											hidden={isDraggingThis}
											slotSize={slotSize}
											onClick={onItemClick}
										/>
									)}
								</DropCell>
							);
						})}
					</div>
				)}
			</div>
		</section>
	);
}

function DraggableItem({
	item,
	side,
	hidden,
	slotSize,
	onClick,
}: {
	item: ItemRow;
	side: StashSide;
	hidden: boolean;
	slotSize: number;
	onClick: (itemId: number, shiftKey: boolean) => void;
}) {
	const handle = useDraggable({
		id: `${side}-${item.id}`,
		data: { kind: side, itemId: item.id } satisfies DragSourceData,
	});
	return (
		<DragSlot
			handle={handle}
			hidden={hidden}
			onClick={(e) => onClick(item.id, e.shiftKey)}
		>
			<ItemCard item={item.data} size={slotSize} suppressTooltip={hidden} />
		</DragSlot>
	);
}
