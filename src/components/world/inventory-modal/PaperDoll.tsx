import { useDraggable, useDroppable } from "@dnd-kit/core";
import { ArrowLeftRight } from "lucide-react";

import DragSlot from "#/components/game/DragSlot";
import ItemCard, { SLOT_EMPTY } from "#/components/game/ItemCard";
import { Button } from "#/components/ui/button";
import { describeBrokenReasons } from "#/game/stats/compute";
import type { ComputedCharacterStats, EquippedSlot } from "#/game/stats/types";
import type { ItemRow } from "#/lib/api-types";
import { m } from "#/paraglide/messages";

import {
	type DragSourceData,
	type DropTargetData,
	SLOT_HIGHLIGHT_CLASS,
	slotHighlight,
} from "./drag";

const EQUIPMENT_SLOT_LAYOUT: Array<{
	slot: EquippedSlot;
	label: () => string;
}> = [
	{ slot: "helmet", label: m.slot_label_helmet },
	{ slot: "amulet", label: m.slot_label_amulet },
	{ slot: "weapon", label: m.slot_label_weapon },
	{ slot: "offhand", label: m.slot_label_offhand },
	{ slot: "chestplate", label: m.slot_label_chestplate },
	{ slot: "belt", label: m.slot_label_belt },
	{ slot: "gloves", label: m.slot_label_gloves },
	{ slot: "boots", label: m.slot_label_boots },
	{ slot: "ring1", label: m.slot_label_ring },
	{ slot: "ring2", label: m.slot_label_ring },
];

const EQUIPMENT_SLOT_SIZE = 96;

export default function PaperDoll({
	equippedBySlot,
	stats,
	characterLevel,
	eligibleSlots,
	dragging,
	handsSwappable,
	avoidRect,
	onItemClick,
	onSwapHands,
}: {
	equippedBySlot: ReadonlyMap<EquippedSlot, ItemRow>;
	stats: ComputedCharacterStats;
	characterLevel: number;
	eligibleSlots: ReadonlySet<EquippedSlot>;
	dragging: DragSourceData | null;
	handsSwappable: boolean;
	avoidRect: DOMRect | null;
	onItemClick: (source: DragSourceData, rect: DOMRect) => void;
	onSwapHands: () => void;
}) {
	const mainHandWeaponType = equippedBySlot.get("weapon")?.data.weaponType;
	return (
		<section className="shrink-0">
			<h3 className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
				{m.inventory_equipped_header()}
			</h3>
			<div className="grid grid-cols-2 gap-2">
				{EQUIPMENT_SLOT_LAYOUT.map(({ slot, label }) => {
					const item = equippedBySlot.get(slot) ?? null;
					const broken = item ? stats.brokenItemIds.has(item.data.id) : false;
					return (
						<EquipmentDroppable
							key={slot}
							slot={slot}
							label={label()}
							item={item}
							dragging={dragging}
							eligible={eligibleSlots.has(slot)}
							handsSwappable={handsSwappable}
							broken={broken}
							brokenReasons={
								broken && item
									? describeBrokenReasons(
											item.data,
											stats,
											characterLevel,
											mainHandWeaponType,
										)
									: undefined
							}
							avoidRect={avoidRect}
							onItemClick={onItemClick}
						/>
					);
				})}
			</div>
			<Button
				variant="hud"
				size="hud"
				caps
				onClick={() => {
					if (handsSwappable) onSwapHands();
				}}
				disabled={!handsSwappable}
				title={
					handsSwappable ? undefined : m.inventory_swap_hands_tooltip_disabled()
				}
				className="mt-3 w-full"
			>
				<ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
				{m.inventory_swap_hands()}
			</Button>
		</section>
	);
}

function EquipmentDroppable({
	slot,
	label,
	item,
	dragging,
	eligible,
	handsSwappable,
	broken,
	brokenReasons,
	avoidRect,
	onItemClick,
}: {
	slot: EquippedSlot;
	label: string;
	item: ItemRow | null;
	dragging: DragSourceData | null;
	eligible: boolean;
	handsSwappable: boolean;
	broken: boolean;
	brokenReasons: string[] | undefined;
	avoidRect: DOMRect | null;
	onItemClick: (source: DragSourceData, rect: DOMRect) => void;
}) {
	const { setNodeRef, isOver } = useDroppable({
		id: `equip-${slot}`,
		data: { kind: "equipment", slot } satisfies DropTargetData,
	});
	const ring = slotHighlight({
		dragging,
		slot,
		isOver,
		eligible,
		handsSwappable,
	});
	const hidden = dragging?.kind === "equipped" && dragging.slot === slot;
	return (
		<div
			ref={setNodeRef}
			style={{ width: EQUIPMENT_SLOT_SIZE, height: EQUIPMENT_SLOT_SIZE }}
			className={`relative flex items-center justify-center rounded-md transition-shadow ${ring ? SLOT_HIGHLIGHT_CLASS[ring] : ""}`}
		>
			<div
				className={`absolute inset-0 flex items-center justify-center rounded-md text-[10px] uppercase tracking-wider text-white/30 ${SLOT_EMPTY}`}
			>
				{!item && label}
			</div>
			{item && (
				<DraggableEquipped
					item={item}
					slot={slot}
					hidden={hidden}
					broken={broken}
					brokenReasons={brokenReasons}
					avoidRect={avoidRect}
					onClick={(rect) =>
						onItemClick({ kind: "equipped", slot, itemId: item.id }, rect)
					}
				/>
			)}
		</div>
	);
}

function DraggableEquipped({
	item,
	slot,
	hidden,
	broken,
	brokenReasons,
	avoidRect,
	onClick,
}: {
	item: ItemRow;
	slot: EquippedSlot;
	hidden: boolean;
	broken: boolean;
	brokenReasons: string[] | undefined;
	avoidRect: DOMRect | null;
	onClick: (rect: DOMRect) => void;
}) {
	const handle = useDraggable({
		id: `equipped-${slot}`,
		data: {
			kind: "equipped",
			slot,
			itemId: item.id,
		} satisfies DragSourceData,
	});
	return (
		<DragSlot handle={handle} hidden={hidden}>
			<ItemCard
				item={item.data}
				size={EQUIPMENT_SLOT_SIZE}
				suppressTooltip={hidden}
				avoidRect={avoidRect}
				broken={broken}
				brokenReasons={brokenReasons}
				onClick={hidden ? undefined : onClick}
			/>
		</DragSlot>
	);
}
