import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	PointerSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { useMutation, useQuery } from "convex/react";
import ItemCard, { SLOT_EMPTY } from "#/components/game/ItemCard";
import Modal from "#/components/Modal";
import { INVENTORY_MAX_SLOTS } from "#/game/inventory/constants";
import { m } from "#/paraglide/messages";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";

const EQUIPMENT_SLOT_LAYOUT: Array<{ slot: string; label: string }> = [
	{ slot: "helmet", label: "HELM" },
	{ slot: "amulet", label: "AMU" },
	{ slot: "weapon", label: "WPN" },
	{ slot: "offhand", label: "OFF" },
	{ slot: "chestplate", label: "BODY" },
	{ slot: "belt", label: "BELT" },
	{ slot: "gloves", label: "GLV" },
	{ slot: "boots", label: "BTS" },
	{ slot: "ring1", label: "RNG" },
	{ slot: "ring2", label: "RNG" },
];

const EQUIPMENT_SLOT_SIZE = 96;
const INVENTORY_SLOT_SIZE = 112;
const INVENTORY_COLUMNS = 8;

type Props = {
	isOpen: boolean;
	onClose: () => void;
	characterId: Id<"characters">;
};

export default function InventoryModal({
	isOpen,
	onClose,
	characterId,
}: Props) {
	const equippedItems = useQuery(
		api.characters.equipped,
		isOpen ? { characterId } : "skip",
	);
	const inventoryItems = useQuery(
		api.characters.inventory,
		isOpen ? { characterId } : "skip",
	);
	// Optimistic update: swap the local inventory immediately so the drag feels
	// instant. Server reconciles when the mutation completes (no visible change
	// because we computed the same result).
	const reorder = useMutation(
		api.characters.reorderInventory,
	).withOptimisticUpdate((localStore, args) => {
		const inv = localStore.getQuery(api.characters.inventory, {
			characterId: args.characterId,
		});
		if (!inv) return;
		const source = inv.find((it) => it._id === args.itemId);
		if (!source) return;
		const occupant = inv.find((it) => it.inventorySlot === args.targetSlot);
		const sourceSlot = source.inventorySlot;
		const next = inv
			.map((it) => {
				if (it._id === source._id) {
					return { ...it, inventorySlot: args.targetSlot };
				}
				if (occupant && it._id === occupant._id) {
					return { ...it, inventorySlot: sourceSlot ?? -1 };
				}
				return it;
			})
			.sort((a, b) => {
				const sa = a.inventorySlot ?? Number.MAX_SAFE_INTEGER;
				const sb = b.inventorySlot ?? Number.MAX_SAFE_INTEGER;
				return sa - sb;
			});
		localStore.setQuery(
			api.characters.inventory,
			{ characterId: args.characterId },
			next,
		);
	});

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
	);

	const equippedBySlot = new Map<string, Doc<"items">>();
	for (const item of equippedItems ?? []) {
		if (item.equippedSlot) equippedBySlot.set(item.equippedSlot, item);
	}

	const inventory = inventoryItems ?? [];

	// Build a slot → item map honoring inventorySlot.
	const inventoryBySlot = new Map<number, Doc<"items">>();
	for (const item of inventory) {
		if (typeof item.inventorySlot === "number") {
			inventoryBySlot.set(item.inventorySlot, item);
		}
	}
	const usedSlots = inventory.length;
	const freeSlots = Math.max(0, INVENTORY_MAX_SLOTS - usedSlots);

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over) return;
		const itemId = active.id as Id<"items">;
		const slotPrefix = "slot-";
		if (typeof over.id !== "string" || !over.id.startsWith(slotPrefix)) return;
		const targetSlot = Number(over.id.slice(slotPrefix.length));
		if (Number.isNaN(targetSlot)) return;
		const source = inventory.find((it) => it._id === itemId);
		if (!source || source.inventorySlot === targetSlot) return;
		void reorder({ characterId, itemId, targetSlot });
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={m.inventory_title({
				used: usedSlots,
				total: INVENTORY_MAX_SLOTS,
			})}
			className="max-w-7xl"
		>
			<div className="flex gap-6">
				{/* Equipped — 2×5 grid */}
				<section className="shrink-0">
					<h3 className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
						{m.inventory_equipped_header()}
					</h3>
					<div className="grid grid-cols-2 gap-2">
						{EQUIPMENT_SLOT_LAYOUT.map(({ slot, label }) => {
							const item = equippedBySlot.get(slot);
							return (
								<div
									key={slot}
									style={{
										width: EQUIPMENT_SLOT_SIZE,
										height: EQUIPMENT_SLOT_SIZE,
									}}
									className="flex items-center justify-center"
								>
									{item ? (
										<ItemCard item={item.data} size={EQUIPMENT_SLOT_SIZE} />
									) : (
										<div
											style={{
												width: EQUIPMENT_SLOT_SIZE,
												height: EQUIPMENT_SLOT_SIZE,
											}}
											className={`flex items-center justify-center rounded-md text-[10px] uppercase tracking-wider text-white/30 ${SLOT_EMPTY}`}
										>
											{label}
										</div>
									)}
								</div>
							);
						})}
					</div>
				</section>

				{/* Vertical divider between equipment and inventory grids */}
				<div className="w-px bg-white/15" aria-hidden />

				{/* Inventory grid with DnD */}
				<section className="min-w-0 flex-1">
					<div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-white/40">
						<h3>{m.inventory_bag_header()}</h3>
						<span>
							{freeSlots === 1
								? m.inventory_free_slot_one({ count: freeSlots })
								: m.inventory_free_slot_other({ count: freeSlots })}
						</span>
					</div>
					<DndContext
						sensors={sensors}
						collisionDetection={closestCenter}
						onDragEnd={handleDragEnd}
					>
						<div className="fancy-scroll max-h-[60vh] overflow-y-auto pr-3">
							<div
								className="grid gap-2"
								style={{
									gridTemplateColumns: `repeat(${INVENTORY_COLUMNS}, ${INVENTORY_SLOT_SIZE}px)`,
								}}
							>
								{Array.from({ length: INVENTORY_MAX_SLOTS }, (_, slot) => (
									<DroppableSlot
										// biome-ignore lint/suspicious/noArrayIndexKey: fixed grid, slot index IS the identity
										key={`slot-${slot}`}
										slot={slot}
										item={inventoryBySlot.get(slot) ?? null}
									/>
								))}
							</div>
						</div>
					</DndContext>
				</section>
			</div>
		</Modal>
	);
}

function DroppableSlot({
	slot,
	item,
}: {
	slot: number;
	item: Doc<"items"> | null;
}) {
	const { setNodeRef, isOver } = useDroppable({ id: `slot-${slot}` });
	const highlight = isOver ? "ring-2 ring-white/80" : "";
	return (
		<div
			ref={setNodeRef}
			style={{ width: INVENTORY_SLOT_SIZE, height: INVENTORY_SLOT_SIZE }}
			className={`relative rounded-md ${highlight}`}
		>
			{item ? (
				<DraggableItem item={item} />
			) : (
				<div
					style={{ width: INVENTORY_SLOT_SIZE, height: INVENTORY_SLOT_SIZE }}
					className={`rounded-md ${SLOT_EMPTY}`}
				/>
			)}
		</div>
	);
}

function DraggableItem({ item }: { item: Doc<"items"> }) {
	const { attributes, listeners, setNodeRef, transform, isDragging } =
		useDraggable({ id: item._id });
	const style: React.CSSProperties = {
		transform: transform
			? `translate3d(${transform.x}px, ${transform.y}px, 0)`
			: undefined,
		zIndex: isDragging ? 100 : undefined,
		opacity: isDragging ? 0.85 : 1,
		cursor: isDragging ? "grabbing" : "grab",
	};
	return (
		<div ref={setNodeRef} style={style} {...listeners} {...attributes}>
			<ItemCard item={item.data} size={INVENTORY_SLOT_SIZE} />
		</div>
	);
}
