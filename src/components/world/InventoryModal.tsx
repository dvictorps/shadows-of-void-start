// The inventory modal: the paper doll and the bag side by side, equip /
// unequip / swap / reorder by drag or through the click menu, discard behind a
// confirmation. This file composes `inventory-modal/*` and owns what spans
// them: the drag and menu state and the server calls. The drag decisions live
// in `inventory-modal/drag.ts`. Pinned by InventoryModal.test.tsx.
import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import ItemCard from "#/components/game/ItemCard";
import Modal from "#/components/Modal";
import { Button } from "#/components/ui/button";
import ItemContextMenu, {
	type MenuAction,
} from "#/components/world/ItemContextMenu";
import { INVENTORY_MAX_SLOTS } from "#/game/inventory/constants";
import {
	canSwapHands,
	isWeapon,
	validSlotsForItem,
} from "#/game/items/equipment";
import { translateItemName } from "#/game/items/item-name";
import type { GeneratedItem } from "#/game/items/types";
import type { ComputedCharacterStats, EquippedSlot } from "#/game/stats/types";
import { useConfirmationModal } from "#/hooks/useConfirmationModal";
import { useEscapeLayer } from "#/hooks/useEscapeLayer";
import type { useInventoryMutations } from "#/hooks/useInventoryMutations";
import type { ItemRow } from "#/lib/api-types";
import { serverErrorMessage } from "#/lib/server-error-message";
import { m } from "#/paraglide/messages";

import BagGrid, { INVENTORY_SLOT_SIZE } from "./inventory-modal/BagGrid";
import {
	type DragSourceData,
	isDragSource,
	isDropTarget,
	resolveDrop,
} from "./inventory-modal/drag";
import PaperDoll from "./inventory-modal/PaperDoll";
import { reorderOrToast } from "./reorder-or-toast";

type InventoryMutations = ReturnType<typeof useInventoryMutations>;
type ArgsOf<Name extends keyof InventoryMutations> = Parameters<
	InventoryMutations[Name]
>[0];

/** The calls the modal makes; the route passes `useInventoryMutations`. */
export interface InventoryServer {
	reorderInventory: (args: ArgsOf<"reorderInventory">) => Promise<object>;
	equipItem: (args: ArgsOf<"equipItem">) => Promise<object>;
	unequipItem: (args: ArgsOf<"unequipItem">) => Promise<object>;
	swapHands: (args: ArgsOf<"swapHands">) => Promise<object>;
	discardFromInventory: (
		args: ArgsOf<"discardFromInventory">,
	) => Promise<object>;
}

type Props = {
	isOpen: boolean;
	onClose: () => void;
	characterId: number;
	stats: ComputedCharacterStats;
	characterLevel: number;
	equippedItems: ItemRow[];
	inventoryItems: ItemRow[];
	server: InventoryServer;
};

export default function InventoryModal({
	isOpen,
	onClose,
	characterId,
	stats,
	characterLevel,
	equippedItems,
	inventoryItems: inventory,
	server,
}: Props) {
	const {
		reorderInventory: reorder,
		equipItem,
		unequipItem,
		swapHands,
		discardFromInventory: discardItem,
	} = server;

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
	);

	const confirm = useConfirmationModal();

	const [active, setActive] = useState<DragSourceData | null>(null);
	// A drag sits above the modal: dnd-kit's sensor cancels it on Escape by
	// itself, and this layer keeps that Escape from closing the modal.
	useEscapeLayer(active !== null);
	const [menu, setMenu] = useState<{
		source: DragSourceData;
		anchor: DOMRect;
	} | null>(null);

	const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
	const openMenu = (source: DragSourceData, anchor: DOMRect) =>
		setMenu({ source, anchor });

	const equippedBySlot = useMemo(() => {
		const map = new Map<EquippedSlot, ItemRow>();
		for (const item of equippedItems) {
			if (item.equippedSlot) map.set(item.equippedSlot, item);
		}
		return map;
	}, [equippedItems]);

	const handsSwappable = useMemo(
		() =>
			canSwapHands(
				equippedBySlot.get("weapon")?.data ?? null,
				equippedBySlot.get("offhand")?.data ?? null,
			),
		[equippedBySlot],
	);

	const activeItem = useMemo<GeneratedItem | null>(() => {
		if (!active) return null;
		if (active.kind === "inventory") {
			return inventory.find((it) => it.id === active.itemId)?.data ?? null;
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
		const data = event.active.data.current;
		if (isDragSource(data)) setActive(data);
	};

	const handleDragCancel = () => setActive(null);

	const handleDragEnd = async (event: DragEndEvent) => {
		const source = event.active.data.current;
		const target = event.over?.data.current;
		setActive(null);
		if (!isDragSource(source) || !isDropTarget(target)) return;
		const action = resolveDrop(source, target, inventory, handsSwappable);
		if (!action) return;
		switch (action.kind) {
			case "reorder":
				await reorderOrToast(reorder, characterId, {
					itemId: action.itemId,
					targetSlot: action.targetSlot,
					swapWithItemId: action.swapWithItemId,
				});
				return;
			case "equip":
				await triggerEquip(action.itemId, action.targetSlot);
				return;
			case "unequip":
				await triggerUnequip(action.slot);
				return;
			case "swapHands":
				await triggerSwapHands();
		}
	};

	const triggerEquip = async (itemId: number, targetSlot: EquippedSlot) => {
		try {
			await equipItem({ characterId, itemId, targetSlot });
		} catch (err) {
			toast.error(serverErrorMessage(err, m.error_equip_failed()));
		}
	};

	const triggerUnequip = async (slot: EquippedSlot) => {
		try {
			await unequipItem({ characterId, slot });
		} catch (err) {
			toast.error(serverErrorMessage(err, m.error_unequip_failed()));
		}
	};

	const triggerSwapHands = async () => {
		try {
			await swapHands({ characterId });
		} catch (err) {
			toast.error(serverErrorMessage(err, m.error_swap_hands_failed()));
		}
	};

	const triggerDiscard = async (itemId: number) => {
		const doc = inventory.find((it) => it.id === itemId);
		if (!doc) return;
		const ok = await confirm({
			title: m.inventory_discard_title({ name: translateItemName(doc.data) }),
			message: m.inventory_discard_message(),
			confirmLabel: m.inventory_discard_action(),
			cancelLabel: m.cancel(),
			variant: "destructive",
		});
		if (!ok) return;
		try {
			await discardItem({ characterId, itemId });
		} catch (err) {
			toast.error(serverErrorMessage(err, m.error_discard_failed()));
		}
	};

	// Plain per-render derivation: the trigger* handlers are recreated every
	// render, so a memo would either go stale or never hit. Cheap — only a
	// handful of entries, and only while a menu is open.
	const menuActions = ((): MenuAction[] => {
		if (!menu) return [];
		const source = menu.source;
		if (source.kind === "inventory") {
			const itemId = source.itemId;
			const doc = inventory.find((it) => it.id === itemId);
			if (!doc) return [];
			const slots = validSlotsForItem(doc.data);
			const equipActions: MenuAction[] = slots.map((slot) => ({
				id: slot,
				label: equipActionLabel(slot, doc.data),
				onClick: () => void triggerEquip(itemId, slot),
			}));
			return [
				...equipActions,
				{
					id: "discard",
					label: m.inventory_discard_action(),
					onClick: () => void triggerDiscard(itemId),
					dividerBefore: equipActions.length > 0,
				},
			];
		}
		const equippedSlot = source.slot;
		return [
			{
				id: "unequip",
				label: m.unequip_action(),
				onClick: () => void triggerUnequip(equippedSlot),
			},
		];
	})();

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={m.inventory_title({
				used: inventory.length,
				total: INVENTORY_MAX_SLOTS,
			})}
			className="max-w-7xl"
			hideHeaderClose
			footer={
				<div className="flex justify-center">
					<Button variant="hud" size="hud-lg" caps onClick={onClose}>
						{m.modal_close_label()}
					</Button>
				</div>
			}
		>
			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragStart={handleDragStart}
				onDragEnd={handleDragEnd}
				onDragCancel={handleDragCancel}
			>
				<div className="flex gap-6">
					<PaperDoll
						equippedBySlot={equippedBySlot}
						stats={stats}
						characterLevel={characterLevel}
						eligibleSlots={validEquipSlots}
						dragging={active}
						handsSwappable={handsSwappable}
						avoidRect={menuRect}
						onItemClick={openMenu}
						onSwapHands={() => void triggerSwapHands()}
					/>

					<div className="w-px bg-white/15" aria-hidden />

					<BagGrid
						inventory={inventory}
						dragging={active}
						avoidRect={menuRect}
						onItemClick={openMenu}
					/>
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
					onLayout={setMenuRect}
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
