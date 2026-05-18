import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	PointerSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { useMutation } from "convex/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import ItemCard, { SLOT_EMPTY } from "#/components/game/ItemCard";
import Modal from "#/components/Modal";
import { INVENTORY_MAX_SLOTS } from "#/game/inventory/constants";
import { validSlotsForItem } from "#/game/items/equipment";
import type { GeneratedItem } from "#/game/items/types";
import { describeBrokenReasons } from "#/game/stats/compute";
import type { ComputedCharacterStats, EquippedSlot } from "#/game/stats/types";
import { m } from "#/paraglide/messages";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";

const EQUIPMENT_SLOT_LAYOUT: Array<{ slot: EquippedSlot; label: string }> = [
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

type DropTargetData =
	| { kind: "inventory"; slot: number }
	| { kind: "equipment"; slot: EquippedSlot };

type DragSourceData =
	| { kind: "inventory"; itemId: Id<"items"> }
	| { kind: "equipped"; slot: EquippedSlot; itemId: Id<"items"> };

type Props = {
	isOpen: boolean;
	onClose: () => void;
	characterId: Id<"characters">;
	stats: ComputedCharacterStats;
	characterLevel: number;
	equippedItems: Doc<"items">[];
	inventoryItems: Doc<"items">[];
};

export default function InventoryModal({
	isOpen,
	onClose,
	characterId,
	stats,
	characterLevel,
	equippedItems,
	inventoryItems,
}: Props) {
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
	const equipItem = useMutation(api.characters.equipItem);
	const unequipItem = useMutation(api.characters.unequipItem);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
	);

	const [active, setActive] = useState<DragSourceData | null>(null);

	const equippedBySlot = useMemo(() => {
		const map = new Map<EquippedSlot, Doc<"items">>();
		for (const item of equippedItems) {
			if (item.equippedSlot) map.set(item.equippedSlot as EquippedSlot, item);
		}
		return map;
	}, [equippedItems]);

	const inventory = inventoryItems;

	const inventoryBySlot = useMemo(() => {
		const map = new Map<number, Doc<"items">>();
		for (const item of inventory) {
			if (typeof item.inventorySlot === "number")
				map.set(item.inventorySlot, item);
		}
		return map;
	}, [inventory]);

	const usedSlots = inventory.length;
	const freeSlots = Math.max(0, INVENTORY_MAX_SLOTS - usedSlots);

	const activeItem = useMemo<GeneratedItem | null>(() => {
		if (!active) return null;
		if (active.kind === "inventory") {
			return inventory.find((it) => it._id === active.itemId)?.data ?? null;
		}
		return equippedBySlot.get(active.slot)?.data ?? null;
	}, [active, inventory, equippedBySlot]);

	const validEquipSlots = useMemo<Set<EquippedSlot>>(() => {
		if (!activeItem || active?.kind !== "inventory") return new Set();
		// planEquip will run on the server too — this is the client preview to
		// drive drop-zone highlight color. Don't pre-compute against current
		// equipped set here; we just say "this slot is structurally eligible".
		return new Set(validSlotsForItem(activeItem));
	}, [activeItem, active]);

	const handleDragStart = (event: DragStartEvent) => {
		const data = event.active.data.current as DragSourceData | undefined;
		if (data) setActive(data);
	};

	const handleDragCancel = () => setActive(null);

	const handleDragEnd = async (event: DragEndEvent) => {
		const source = event.active.data.current as DragSourceData | undefined;
		const target = event.over?.data.current as DropTargetData | undefined;
		setActive(null);
		if (!source || !target) return;

		// Inventory item → inventory slot: reorder.
		if (source.kind === "inventory" && target.kind === "inventory") {
			const sourceDoc = inventory.find((it) => it._id === source.itemId);
			if (!sourceDoc || sourceDoc.inventorySlot === target.slot) return;
			void reorder({
				characterId,
				itemId: source.itemId,
				targetSlot: target.slot,
			});
			return;
		}

		// Inventory item → equipment slot: equip.
		if (source.kind === "inventory" && target.kind === "equipment") {
			const sourceDoc = inventory.find((it) => it._id === source.itemId);
			if (!sourceDoc) return;
			if (!validSlotsForItem(sourceDoc.data).includes(target.slot)) return;
			try {
				await equipItem({
					characterId,
					itemId: source.itemId,
					targetSlot: target.slot,
				});
			} catch (err) {
				toast.error(equipErrorMessage(err));
			}
			return;
		}

		// Equipped item → inventory slot: unequip (slot is just a hint; server
		// places it in the first free slot).
		if (source.kind === "equipped" && target.kind === "inventory") {
			try {
				await unequipItem({ characterId, slot: source.slot });
			} catch (err) {
				toast.error(equipErrorMessage(err));
			}
			return;
		}

		// Equipped → equipment: unsupported in this iteration (user can unequip,
		// then equip from inventory).
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
			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragStart={handleDragStart}
				onDragEnd={handleDragEnd}
				onDragCancel={handleDragCancel}
			>
				<div className="flex gap-6">
					<section className="shrink-0">
						<h3 className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
							{m.inventory_equipped_header()}
						</h3>
						<div className="grid grid-cols-2 gap-2">
							{EQUIPMENT_SLOT_LAYOUT.map(({ slot, label }) => {
								const item = equippedBySlot.get(slot);
								const broken = item
									? stats.brokenItemIds.has(item.data.id)
									: false;
								const reasons =
									broken && item
										? describeBrokenReasons(item.data, stats, characterLevel)
										: undefined;
								return (
									<EquipmentDroppable
										key={slot}
										slot={slot}
										label={label}
										item={item ?? null}
										eligible={validEquipSlots.has(slot)}
										dragging={active}
										broken={broken}
										brokenReasons={reasons}
									/>
								);
							})}
						</div>
					</section>

					<div className="w-px bg-white/15" aria-hidden />

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
								{Array.from({ length: INVENTORY_MAX_SLOTS }, (_, slot) => (
									<InventoryDroppable
										// biome-ignore lint/suspicious/noArrayIndexKey: fixed grid, slot index IS the identity
										key={`slot-${slot}`}
										slot={slot}
										item={inventoryBySlot.get(slot) ?? null}
										isDraggingThis={
											active?.kind === "inventory" &&
											inventoryBySlot.get(slot)?._id === active.itemId
										}
									/>
								))}
							</div>
						</div>
					</section>
				</div>
				<DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
					{activeItem ? (
						<ItemCard
							item={activeItem}
							size={INVENTORY_SLOT_SIZE}
							suppressTooltip
						/>
					) : null}
				</DragOverlay>
			</DndContext>
		</Modal>
	);
}

function equipErrorMessage(err: unknown): string {
	const msg = err instanceof Error ? err.message : String(err);
	if (msg.includes("wrong-slot")) return "Slot incompatível";
	if (msg.includes("mixed-archetype"))
		return "Não pode misturar arquetipos no dual-wield";
	if (msg.includes("needs-main-hand"))
		return "Equipe uma arma principal primeiro";
	if (msg.includes("offhand-not-weapon"))
		return "Slot off-hand aceita só armas ou escudos";
	if (msg.includes("Inventory") || msg.includes("Inventário"))
		return "Inventário cheio — libere espaço primeiro";
	if (msg.includes("Level")) return msg.replace("Level", "Nível");
	if (msg.includes("Strength")) return msg.replace("Strength", "Força");
	if (msg.includes("Dexterity")) return msg.replace("Dexterity", "Destreza");
	if (msg.includes("Intelligence"))
		return msg.replace("Intelligence", "Inteligência");
	return msg;
}

function InventoryDroppable({
	slot,
	item,
	isDraggingThis,
}: {
	slot: number;
	item: Doc<"items"> | null;
	isDraggingThis: boolean;
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
			{item && <DraggableInventoryItem item={item} hidden={isDraggingThis} />}
		</div>
	);
}

function DraggableInventoryItem({
	item,
	hidden,
}: {
	item: Doc<"items">;
	hidden: boolean;
}) {
	const { attributes, listeners, setNodeRef } = useDraggable({
		id: item._id,
		data: { kind: "inventory", itemId: item._id } satisfies DragSourceData,
	});
	return (
		<div
			ref={setNodeRef}
			className="absolute inset-0"
			style={{
				opacity: hidden ? 0 : 1,
				cursor: hidden ? "grabbing" : "grab",
			}}
			{...listeners}
			{...attributes}
		>
			<ItemCard
				item={item.data}
				size={INVENTORY_SLOT_SIZE}
				suppressTooltip={hidden}
			/>
		</div>
	);
}

function EquipmentDroppable({
	slot,
	label,
	item,
	eligible,
	dragging,
	broken,
	brokenReasons,
}: {
	slot: EquippedSlot;
	label: string;
	item: Doc<"items"> | null;
	eligible: boolean;
	dragging: DragSourceData | null;
	broken: boolean;
	brokenReasons: string[] | undefined;
}) {
	const { setNodeRef, isOver } = useDroppable({
		id: `equip-${slot}`,
		data: { kind: "equipment", slot } satisfies DropTargetData,
	});
	const isDraggingThis =
		dragging?.kind === "equipped" && dragging.slot === slot;
	// Highlight color depends on validity: yellow if the active dragged item
	// can equip here, red if it's an inventory drag of an incompatible item.
	let highlight = "";
	if (isOver) {
		if (dragging?.kind === "inventory") {
			highlight = eligible
				? "ring-2 ring-yellow-300/80"
				: "ring-2 ring-red-500/70";
		}
	}
	return (
		<div
			ref={setNodeRef}
			style={{ width: EQUIPMENT_SLOT_SIZE, height: EQUIPMENT_SLOT_SIZE }}
			className={`relative flex items-center justify-center rounded-md transition-shadow ${highlight}`}
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
					hidden={isDraggingThis}
					broken={broken}
					brokenReasons={brokenReasons}
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
}: {
	item: Doc<"items">;
	slot: EquippedSlot;
	hidden: boolean;
	broken: boolean;
	brokenReasons: string[] | undefined;
}) {
	const { attributes, listeners, setNodeRef } = useDraggable({
		id: `equipped-${slot}`,
		data: {
			kind: "equipped",
			slot,
			itemId: item._id,
		} satisfies DragSourceData,
	});
	return (
		<div
			ref={setNodeRef}
			className="absolute inset-0"
			style={{
				opacity: hidden ? 0 : 1,
				cursor: hidden ? "grabbing" : "grab",
			}}
			{...listeners}
			{...attributes}
		>
			<ItemCard
				item={item.data}
				size={EQUIPMENT_SLOT_SIZE}
				suppressTooltip={hidden}
				broken={broken}
				brokenReasons={brokenReasons}
			/>
		</div>
	);
}
