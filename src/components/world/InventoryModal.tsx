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
import ItemContextMenu, {
	type MenuAction,
} from "#/components/world/ItemContextMenu";
import { bySlotAsc, INVENTORY_MAX_SLOTS } from "#/game/inventory/constants";
import { isWeapon, planEquip, validSlotsForItem } from "#/game/items/equipment";
import type { GeneratedItem } from "#/game/items/types";
import { describeBrokenReasons } from "#/game/stats/compute";
import {
	type ComputedCharacterStats,
	type EquippedSlot,
	narrowEquippedSlot,
} from "#/game/stats/types";
import { convexErrorMessage } from "#/lib/convex-errors";
import { m } from "#/paraglide/messages";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";

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
		api.items.reorderInventory,
	).withOptimisticUpdate((localStore, args) => {
		const inv = localStore.getQuery(api.items.inventory, {
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
			.sort(bySlotAsc);
		localStore.setQuery(
			api.items.inventory,
			{ characterId: args.characterId },
			next,
		);
	});
	const equipItem = useMutation(api.items.equipItem).withOptimisticUpdate(
		(localStore, args) => {
			const inv = localStore.getQuery(api.items.inventory, {
				characterId: args.characterId,
			});
			const equipped = localStore.getQuery(api.items.equipped, {
				characterId: args.characterId,
			});
			if (!inv || !equipped) return;
			const newItem = inv.find((it) => it._id === args.itemId);
			if (!newItem) return;

			const currentEquipped = equipped.flatMap((it) => {
				const slot = narrowEquippedSlot(it.equippedSlot);
				return slot ? [{ slot, item: it.data }] : [];
			});
			const plan = planEquip({
				item: newItem.data,
				targetSlot: args.targetSlot,
				currentEquipped,
			});
			if (plan.reject) return;

			const displacedSlots = new Set(plan.displaced.map((d) => d.slot));
			const displacedDocs = equipped.filter((it) => {
				const slot = narrowEquippedSlot(it.equippedSlot);
				return slot !== undefined && displacedSlots.has(slot);
			});

			const occupied = new Set<number>();
			for (const it of inv) {
				if (it._id === args.itemId) continue;
				if (typeof it.inventorySlot === "number")
					occupied.add(it.inventorySlot);
			}
			const nextFreeSlot = (): number => {
				for (let i = 0; i < INVENTORY_MAX_SLOTS; i++) {
					if (!occupied.has(i)) {
						occupied.add(i);
						return i;
					}
				}
				return -1;
			};

			const displacedToInventory = displacedDocs.map((d) => ({
				...d,
				locationKind: "inventory" as const,
				equippedSlot: undefined,
				inventorySlot: nextFreeSlot(),
			}));
			const newInventory = [
				...inv.filter((it) => it._id !== args.itemId),
				...displacedToInventory,
			].sort(bySlotAsc);

			const displacedIds = new Set(displacedDocs.map((d) => d._id));
			const newEquipped = [
				...equipped.filter((it) => !displacedIds.has(it._id)),
				{
					...newItem,
					locationKind: "equipped" as const,
					equippedSlot: args.targetSlot,
					inventorySlot: undefined,
				},
			];

			localStore.setQuery(
				api.items.inventory,
				{ characterId: args.characterId },
				newInventory,
			);
			localStore.setQuery(
				api.items.equipped,
				{ characterId: args.characterId },
				newEquipped,
			);
		},
	);
	const unequipItem = useMutation(
		api.items.unequipItem,
	).withOptimisticUpdate((localStore, args) => {
		const inv = localStore.getQuery(api.items.inventory, {
			characterId: args.characterId,
		});
		const equipped = localStore.getQuery(api.items.equipped, {
			characterId: args.characterId,
		});
		if (!inv || !equipped) return;
		const item = equipped.find((it) => it.equippedSlot === args.slot);
		if (!item) return;

		const occupied = new Set<number>();
		for (const it of inv) {
			if (typeof it.inventorySlot === "number") occupied.add(it.inventorySlot);
		}
		let firstFree = -1;
		for (let i = 0; i < INVENTORY_MAX_SLOTS; i++) {
			if (!occupied.has(i)) {
				firstFree = i;
				break;
			}
		}
		if (firstFree === -1) return; // server will reject; skip optimistic

		const newInventory = [
			...inv,
			{
				...item,
				locationKind: "inventory" as const,
				equippedSlot: undefined,
				inventorySlot: firstFree,
			},
		].sort(bySlotAsc);
		const newEquipped = equipped.filter((it) => it._id !== item._id);

		localStore.setQuery(
			api.items.inventory,
			{ characterId: args.characterId },
			newInventory,
		);
		localStore.setQuery(
			api.items.equipped,
			{ characterId: args.characterId },
			newEquipped,
		);
	});

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
	);

	const [active, setActive] = useState<DragSourceData | null>(null);
	const [menu, setMenu] = useState<{
		source: DragSourceData;
		anchor: DOMRect;
	} | null>(null);

	const equippedBySlot = useMemo(() => {
		const map = new Map<EquippedSlot, Doc<"items">>();
		for (const item of equippedItems) {
			const slot = narrowEquippedSlot(item.equippedSlot);
			if (slot) map.set(slot, item);
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
		const data = asDragSource(event.active.data.current);
		if (data) setActive(data);
	};

	const handleDragCancel = () => setActive(null);

	const handleDragEnd = async (event: DragEndEvent) => {
		const source = asDragSource(event.active.data.current);
		const target = asDropTarget(event.over?.data.current);
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
				toast.error(convexErrorMessage(err, m.error_equip_failed()));
			}
			return;
		}

		// Equipped item → inventory slot: unequip (slot is just a hint; server
		// places it in the first free slot).
		if (source.kind === "equipped" && target.kind === "inventory") {
			try {
				await unequipItem({ characterId, slot: source.slot });
			} catch (err) {
				toast.error(convexErrorMessage(err, m.error_equip_failed()));
			}
			return;
		}

		// Equipped → equipment: unsupported in this iteration (user can unequip,
		// then equip from inventory).
	};

	const triggerEquip = async (
		itemId: Id<"items">,
		targetSlot: EquippedSlot,
	) => {
		try {
			await equipItem({ characterId, itemId, targetSlot });
		} catch (err) {
			toast.error(convexErrorMessage(err, m.error_equip_failed()));
		}
	};

	const triggerUnequip = async (slot: EquippedSlot) => {
		try {
			await unequipItem({ characterId, slot });
		} catch (err) {
			toast.error(convexErrorMessage(err, m.error_unequip_failed()));
		}
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: triggerEquip / triggerUnequip are recreated every render but capture stable mutations; including them would defeat the useMemo
	const menuActions = useMemo<MenuAction[]>(() => {
		if (!menu) return [];
		const source = menu.source;
		if (source.kind === "inventory") {
			const itemId = source.itemId;
			const doc = inventory.find((it) => it._id === itemId);
			if (!doc) return [];
			const slots = validSlotsForItem(doc.data);
			return slots.map((slot) => ({
				id: slot,
				label: equipActionLabel(slot, doc.data),
				onClick: () => void triggerEquip(itemId, slot),
			}));
		}
		const equippedSlot = source.slot;
		return [
			{
				id: "unequip",
				label: m.unequip_action(),
				onClick: () => void triggerUnequip(equippedSlot),
			},
		];
	}, [menu, inventory]);

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
										label={label()}
										item={item ?? null}
										eligible={validEquipSlots.has(slot)}
										dragging={active}
										broken={broken}
										brokenReasons={reasons}
										onItemClick={(rect) => {
											if (!item) return;
											setMenu({
												source: { kind: "equipped", slot, itemId: item._id },
												anchor: rect,
											});
										}}
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
										onItemClick={(itemId, rect) =>
											setMenu({
												source: { kind: "inventory", itemId },
												anchor: rect,
											})
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
			{menu && menuActions.length > 0 && (
				<ItemContextMenu
					anchor={menu.anchor}
					actions={menuActions}
					onClose={() => setMenu(null)}
				/>
			)}
		</Modal>
	);
}

function equipActionLabel(slot: EquippedSlot, item: GeneratedItem): string {
	switch (slot) {
		case "weapon":
			return m.equip_main_hand();
		case "offhand":
			return isWeapon(item) ? m.equip_off_hand() : m.equip_generic();
		case "ring1":
			return m.equip_ring_1();
		case "ring2":
			return m.equip_ring_2();
		default:
			return m.equip_generic();
	}
}

function InventoryDroppable({
	slot,
	item,
	isDraggingThis,
	onItemClick,
}: {
	slot: number;
	item: Doc<"items"> | null;
	isDraggingThis: boolean;
	onItemClick: (itemId: Id<"items">, rect: DOMRect) => void;
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
					onClick={onItemClick}
				/>
			)}
		</div>
	);
}

function DraggableInventoryItem({
	item,
	hidden,
	onClick,
}: {
	item: Doc<"items">;
	hidden: boolean;
	onClick: (itemId: Id<"items">, rect: DOMRect) => void;
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
				onClick={hidden ? undefined : (rect) => onClick(item._id, rect)}
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
	onItemClick,
}: {
	slot: EquippedSlot;
	label: string;
	item: Doc<"items"> | null;
	eligible: boolean;
	dragging: DragSourceData | null;
	broken: boolean;
	brokenReasons: string[] | undefined;
	onItemClick: (rect: DOMRect) => void;
}) {
	const { setNodeRef, isOver } = useDroppable({
		id: `equip-${slot}`,
		data: { kind: "equipment", slot } satisfies DropTargetData,
	});
	const isDraggingThis =
		dragging?.kind === "equipped" && dragging.slot === slot;
	// Three highlight tiers, decreasing intensity as we move away from a direct
	// hover: full ring under the cursor, soft glow on every eligible slot while
	// dragging, red ring when hovering an incompatible slot.
	let highlight = "";
	if (dragging?.kind === "inventory") {
		if (isOver) {
			highlight = eligible
				? "ring-2 ring-yellow-300/90 shadow-[0_0_14px_rgba(253,224,71,0.55)]"
				: "ring-2 ring-red-500/70";
		} else if (eligible) {
			highlight =
				"ring-2 ring-yellow-300/40 shadow-[0_0_8px_rgba(253,224,71,0.25)]";
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
					onClick={onItemClick}
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
	onClick,
}: {
	item: Doc<"items">;
	slot: EquippedSlot;
	hidden: boolean;
	broken: boolean;
	brokenReasons: string[] | undefined;
	onClick: (rect: DOMRect) => void;
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
				onClick={hidden ? undefined : onClick}
			/>
		</div>
	);
}

// ── DnD payload narrowers ─────────────────────────────────────────────────
// @dnd-kit types `data.current` as Record<string, unknown> | undefined. We
// validate the shape here so a misregistered draggable in the future can't
// silently coerce into a DragSourceData and crash a handler.

function asDragSource(d: unknown): DragSourceData | undefined {
	if (!d || typeof d !== "object") return undefined;
	const obj = d as Record<string, unknown>;
	const itemId = obj.itemId;
	if (typeof itemId !== "string") return undefined;
	if (obj.kind === "inventory") {
		return { kind: "inventory", itemId: itemId as Id<"items"> };
	}
	if (obj.kind === "equipped" && typeof obj.slot === "string") {
		const slot = narrowEquippedSlot(obj.slot);
		if (slot) return { kind: "equipped", slot, itemId: itemId as Id<"items"> };
	}
	return undefined;
}

function asDropTarget(d: unknown): DropTargetData | undefined {
	if (!d || typeof d !== "object") return undefined;
	const obj = d as Record<string, unknown>;
	if (obj.kind === "inventory" && typeof obj.slot === "number") {
		return { kind: "inventory", slot: obj.slot };
	}
	if (obj.kind === "equipment" && typeof obj.slot === "string") {
		const slot = narrowEquippedSlot(obj.slot);
		if (slot) return { kind: "equipment", slot };
	}
	return undefined;
}
