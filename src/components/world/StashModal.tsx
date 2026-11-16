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
import { useMemo, useState } from "react";
import { toast } from "sonner";

import ItemCard, { SLOT_EMPTY } from "#/components/game/ItemCard";
import Modal from "#/components/Modal";
import { Button } from "#/components/ui/button";
import {
	INVENTORY_MAX_SLOTS,
	STASH_MAX_SLOTS,
} from "#/game/inventory/constants";
import type { GeneratedItem } from "#/game/items/types";
import { useCompactViewport } from "#/hooks/useCompactViewport";
import { useInFlight } from "#/hooks/useInFlight";
import { useOpenedEdge } from "#/hooks/useOpenedEdge";
import type { ItemRow } from "#/lib/api-types";
import { m } from "#/paraglide/messages";

const SLOT_SIZE_DEFAULT = 76;
const SLOT_SIZE_COMPACT = 64;
const COLUMNS = 8;

type DropTargetData =
	| { kind: "inventory"; slot: number }
	| { kind: "stash"; slot: number };

type DragSourceData =
	| { kind: "inventory"; itemId: number }
	| { kind: "stash"; itemId: number };

type Props = {
	isOpen: boolean;
	onClose: () => void;
	inventoryItems: ItemRow[];
	stashItems: ItemRow[];
	onDeposit: (
		itemIds: number[],
	) => Promise<{ deposited: number; failed: number }>;
	onWithdraw: (
		itemIds: number[],
	) => Promise<{ withdrawn: number; failed: number }>;
	onReorderInventory: (args: {
		itemId: number;
		targetSlot: number;
		swapWithItemId?: number;
	}) => void;
	onReorderStash: (args: {
		itemId: number;
		targetSlot: number;
		swapWithItemId?: number;
	}) => void;
};

export default function StashModal({
	isOpen,
	onClose,
	inventoryItems,
	stashItems,
	onDeposit,
	onWithdraw,
	onReorderInventory,
	onReorderStash,
}: Props) {
	const compact = useCompactViewport();
	const slotSize = compact ? SLOT_SIZE_COMPACT : SLOT_SIZE_DEFAULT;

	const [active, setActive] = useState<DragSourceData | null>(null);
	const [invSelected, setInvSelected] = useState<Set<number>>(new Set());
	const [stashSelected, setStashSelected] = useState<Set<number>>(new Set());
	const [isDepositing, runDeposit] = useInFlight(isOpen);
	const [isWithdrawing, runWithdraw] = useInFlight(isOpen);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
	);

	// Clear both selections on the closed → open edge, during render ("adjust
	// state when a prop changes") so the first open frame is already clean.
	const justOpened = useOpenedEdge(isOpen);
	if (justOpened) {
		setInvSelected(new Set());
		setStashSelected(new Set());
	}

	const inventoryBySlot = useMemo(() => {
		const map = new Map<number, ItemRow>();
		for (const item of inventoryItems) {
			if (item.inventorySlot !== null) map.set(item.inventorySlot, item);
		}
		return map;
	}, [inventoryItems]);

	const stashBySlot = useMemo(() => {
		const map = new Map<number, ItemRow>();
		for (const item of stashItems) {
			if (item.stashSlot !== null) map.set(item.stashSlot, item);
		}
		return map;
	}, [stashItems]);

	const invFree = Math.max(0, INVENTORY_MAX_SLOTS - inventoryItems.length);
	const stashFree = Math.max(0, STASH_MAX_SLOTS - stashItems.length);

	const activeItem = useMemo<GeneratedItem | null>(() => {
		if (!active) return null;
		if (active.kind === "inventory") {
			return inventoryItems.find((it) => it.id === active.itemId)?.data ?? null;
		}
		return stashItems.find((it) => it.id === active.itemId)?.data ?? null;
	}, [active, inventoryItems, stashItems]);

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

		// Same panel reorder
		if (source.kind === "inventory" && target.kind === "inventory") {
			const doc = inventoryItems.find((it) => it.id === source.itemId);
			if (!doc || doc.inventorySlot === target.slot) return;
			const occupant = inventoryItems.find(
				(it) => it.inventorySlot === target.slot && it.id !== source.itemId,
			);
			onReorderInventory({
				itemId: source.itemId,
				targetSlot: target.slot,
				swapWithItemId: occupant?.id,
			});
			return;
		}
		if (source.kind === "stash" && target.kind === "stash") {
			const doc = stashItems.find((it) => it.id === source.itemId);
			if (!doc || doc.stashSlot === target.slot) return;
			const stashOccupant = stashItems.find(
				(it) => it.stashSlot === target.slot && it.id !== source.itemId,
			);
			onReorderStash({
				itemId: source.itemId,
				targetSlot: target.slot,
				swapWithItemId: stashOccupant?.id,
			});
			return;
		}

		// Cross-panel transfer
		if (source.kind === "inventory" && target.kind === "stash") {
			try {
				const result = await onDeposit([source.itemId]);
				if (result.failed > 0) toast.error(m.stash_full_error());
			} catch (err) {
				toast.error(err instanceof Error ? err.message : m.stash_full_error());
			}
			return;
		}
		if (source.kind === "stash" && target.kind === "inventory") {
			try {
				const result = await onWithdraw([source.itemId]);
				if (result.failed > 0) toast.error(m.inventory_full_error());
			} catch (err) {
				toast.error(
					err instanceof Error ? err.message : m.inventory_full_error(),
				);
			}
		}
	};

	const handleShiftClickInv = async (itemId: number) => {
		try {
			const result = await onDeposit([itemId]);
			if (result.failed > 0) toast.error(m.stash_full_error());
		} catch (err) {
			toast.error(err instanceof Error ? err.message : m.stash_full_error());
		}
	};

	const handleShiftClickStash = async (itemId: number) => {
		try {
			const result = await onWithdraw([itemId]);
			if (result.failed > 0) toast.error(m.inventory_full_error());
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : m.inventory_full_error(),
			);
		}
	};

	const handleDepositSelected = async () => {
		const ids = inventoryItems
			.filter((it) => invSelected.has(it.id))
			.map((it) => it.id);
		if (ids.length === 0) return;
		const prev = new Set(invSelected);
		await runDeposit(async () => {
			setInvSelected(new Set());
			try {
				const result = await onDeposit(ids);
				if (result.failed > 0) {
					toast(
						m.stash_deposit_result({
							deposited: result.deposited,
							failed: result.failed,
						}),
					);
				}
			} catch (err) {
				setInvSelected(prev);
				toast.error(err instanceof Error ? err.message : m.stash_full_error());
			}
		});
	};

	const handleWithdrawSelected = async () => {
		const ids = stashItems
			.filter((it) => stashSelected.has(it.id))
			.map((it) => it.id);
		if (ids.length === 0) return;
		const prev = new Set(stashSelected);
		await runWithdraw(async () => {
			setStashSelected(new Set());
			try {
				const result = await onWithdraw(ids);
				if (result.failed > 0) {
					toast(
						m.stash_withdraw_result({
							withdrawn: result.withdrawn,
							failed: result.failed,
						}),
					);
				}
			} catch (err) {
				setStashSelected(prev);
				toast.error(
					err instanceof Error ? err.message : m.inventory_full_error(),
				);
			}
		});
	};

	const toggleInv = (id: number) => {
		setInvSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const toggleStash = (id: number) => {
		setStashSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const toggleAllInv = () => {
		if (
			invSelected.size === inventoryItems.length &&
			inventoryItems.length > 0
		) {
			setInvSelected(new Set());
		} else {
			setInvSelected(new Set(inventoryItems.map((it) => it.id)));
		}
	};

	const toggleAllStash = () => {
		if (stashSelected.size === stashItems.length && stashItems.length > 0) {
			setStashSelected(new Set());
		} else {
			setStashSelected(new Set(stashItems.map((it) => it.id)));
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={m.stash_title({ used: stashItems.length, total: STASH_MAX_SLOTS })}
			className={compact ? "max-w-[1200px]" : "max-w-[1440px]"}
			hideHeaderClose
			footer={
				<div className="flex items-center justify-between">
					<div className="flex gap-3">
						{invSelected.size > 0 && (
							<Button
								type="button"
								variant="starkMuted"
								size="lg"
								onClick={handleDepositSelected}
								disabled={isDepositing}
								className="text-sm uppercase tracking-wider"
							>
								{m.stash_deposit_selected()} ({invSelected.size})
							</Button>
						)}
						{stashSelected.size > 0 && (
							<Button
								type="button"
								variant="starkMuted"
								size="lg"
								onClick={handleWithdrawSelected}
								disabled={isWithdrawing}
								className="text-sm uppercase tracking-wider"
							>
								{m.stash_withdraw_selected()} ({stashSelected.size})
							</Button>
						)}
					</div>
					<button
						type="button"
						onClick={onClose}
						className="border-2 border-white/40 bg-black px-6 py-2 font-medium text-sm text-white/80 uppercase tracking-[0.25em] transition hover:border-white hover:bg-white/10 hover:text-white"
					>
						{m.modal_close_label()}
					</button>
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
				<div className="flex gap-4">
					{/* Inventory panel */}
					<section className="min-w-0 flex-1">
						<div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-white/40">
							<h3>{m.stash_inventory_header()}</h3>
							<div className="flex items-center gap-3">
								{inventoryItems.length > 0 && (
									<button
										type="button"
										onClick={toggleAllInv}
										className="text-white/60 transition hover:text-white"
									>
										{invSelected.size === inventoryItems.length
											? m.stash_deselect_all()
											: m.stash_select_all()}
									</button>
								)}
								<span>
									{invFree === 1
										? m.inventory_free_slot_one({ count: invFree })
										: m.inventory_free_slot_other({ count: invFree })}
								</span>
							</div>
						</div>
						<div className="fancy-scroll max-h-[60vh] overflow-y-auto pr-2">
							<div
								className="grid gap-1"
								style={{
									gridTemplateColumns: `repeat(${COLUMNS}, ${slotSize}px)`,
								}}
							>
								{Array.from({ length: INVENTORY_MAX_SLOTS }, (_, slot) => {
									const item = inventoryBySlot.get(slot) ?? null;
									return (
										<StashSlotDroppable
											key={`inv-${slot}`}
											droppableId={`inv-${slot}`}
											kind="inventory"
											slot={slot}
											item={item}
											dragKind="inventory"
											isDraggingThis={
												active?.kind === "inventory" &&
												item?.id === active.itemId
											}
											isSelected={item ? invSelected.has(item.id) : false}
											onItemClick={(itemId, shiftKey) => {
												if (shiftKey) {
													void handleShiftClickInv(itemId);
												} else {
													toggleInv(itemId);
												}
											}}
											slotSize={slotSize}
										/>
									);
								})}
							</div>
						</div>
					</section>

					{/* Divider */}
					<div className="w-px bg-white/15" aria-hidden />

					{/* Stash panel */}
					<section className="min-w-0 flex-1">
						<div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-white/40">
							<h3>{m.stash_header()}</h3>
							<div className="flex items-center gap-3">
								{stashItems.length > 0 && (
									<button
										type="button"
										onClick={toggleAllStash}
										className="text-white/60 transition hover:text-white"
									>
										{stashSelected.size === stashItems.length
											? m.stash_deselect_all()
											: m.stash_select_all()}
									</button>
								)}
								<span>
									{stashFree === 1
										? m.stash_free_slot_one({ count: stashFree })
										: m.stash_free_slot_other({ count: stashFree })}
								</span>
							</div>
						</div>
						<div className="fancy-scroll max-h-[60vh] overflow-y-auto pr-2">
							{stashItems.length === 0 && !active ? (
								<p className="py-12 text-center text-sm text-white/40">
									{m.stash_empty()}
								</p>
							) : (
								<div
									className="grid gap-1"
									style={{
										gridTemplateColumns: `repeat(${COLUMNS}, ${slotSize}px)`,
									}}
								>
									{Array.from({ length: STASH_MAX_SLOTS }, (_, slot) => {
										const item = stashBySlot.get(slot) ?? null;
										return (
											<StashSlotDroppable
												key={`stash-${slot}`}
												droppableId={`stash-${slot}`}
												kind="stash"
												slot={slot}
												item={item}
												dragKind="stash"
												isDraggingThis={
													active?.kind === "stash" && item?.id === active.itemId
												}
												isSelected={item ? stashSelected.has(item.id) : false}
												onItemClick={(itemId, shiftKey) => {
													if (shiftKey) {
														void handleShiftClickStash(itemId);
													} else {
														toggleStash(itemId);
													}
												}}
												slotSize={slotSize}
											/>
										);
									})}
								</div>
							)}
						</div>
					</section>
				</div>

				<DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
					{activeItem ? (
						<ItemCard item={activeItem} size={slotSize} suppressTooltip />
					) : null}
				</DragOverlay>
			</DndContext>
		</Modal>
	);
}

function StashSlotDroppable({
	droppableId,
	kind,
	slot,
	item,
	dragKind,
	isDraggingThis,
	isSelected,
	onItemClick,
	slotSize,
}: {
	droppableId: string;
	kind: "inventory" | "stash";
	slot: number;
	item: ItemRow | null;
	dragKind: "inventory" | "stash";
	isDraggingThis: boolean;
	isSelected: boolean;
	onItemClick: (itemId: number, shiftKey: boolean) => void;
	slotSize: number;
}) {
	const { setNodeRef: dropRef, isOver } = useDroppable({
		id: droppableId,
		data: { kind, slot } satisfies DropTargetData,
	});
	const highlight = isOver ? "ring-2 ring-yellow-300/80" : "";
	const selectedRing =
		isSelected && !isDraggingThis ? "ring-2 ring-sky-400/80" : "";
	return (
		<div
			ref={dropRef}
			style={{ width: slotSize, height: slotSize }}
			className={`relative rounded-md transition-shadow ${highlight || selectedRing}`}
		>
			<div className={`absolute inset-0 rounded-md ${SLOT_EMPTY}`} />
			{item && (
				<DraggableStashItem
					item={item}
					dragKind={dragKind}
					hidden={isDraggingThis}
					onClick={(itemId, shiftKey) => onItemClick(itemId, shiftKey)}
					slotSize={slotSize}
				/>
			)}
		</div>
	);
}

function DraggableStashItem({
	item,
	dragKind,
	hidden,
	onClick,
	slotSize,
}: {
	item: ItemRow;
	dragKind: "inventory" | "stash";
	hidden: boolean;
	onClick: (itemId: number, shiftKey: boolean) => void;
	slotSize: number;
}) {
	const { attributes, listeners, setNodeRef } = useDraggable({
		id: `${dragKind}-${item.id}`,
		data: { kind: dragKind, itemId: item.id } satisfies DragSourceData,
	});
	return (
		<div
			ref={setNodeRef}
			className="absolute inset-0"
			style={{
				opacity: hidden ? 0 : 1,
				cursor: hidden ? "grabbing" : "grab",
			}}
			onClick={
				hidden
					? undefined
					: (e) => {
							e.stopPropagation();
							onClick(item.id, e.shiftKey);
						}
			}
			{...listeners}
			{...attributes}
		>
			<ItemCard item={item.data} size={slotSize} suppressTooltip={hidden} />
		</div>
	);
}

// @dnd-kit types `data.current` as an open record; these guards are the
// `unknown` boundary. `itemId` is only checked to be a number: every
// draggable here registers a real item id.

function isDragSource(d: unknown): d is DragSourceData {
	if (typeof d !== "object" || d === null) return false;
	if (!("kind" in d) || !("itemId" in d)) return false;
	return (
		(d.kind === "inventory" || d.kind === "stash") &&
		typeof d.itemId === "number"
	);
}

function isDropTarget(d: unknown): d is DropTargetData {
	if (typeof d !== "object" || d === null) return false;
	if (!("kind" in d) || !("slot" in d)) return false;
	return (
		(d.kind === "inventory" || d.kind === "stash") && typeof d.slot === "number"
	);
}
