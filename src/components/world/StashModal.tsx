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
import { useEffect, useMemo, useState } from "react";
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
import { m } from "#/paraglide/messages";
import type { Doc, Id } from "../../../convex/_generated/dataModel";

const SLOT_SIZE_DEFAULT = 76;
const SLOT_SIZE_COMPACT = 64;
const COLUMNS = 8;

type DropTargetData =
	| { kind: "inventory"; slot: number }
	| { kind: "stash"; slot: number };

type DragSourceData =
	| { kind: "inventory"; itemId: Id<"items"> }
	| { kind: "stash"; itemId: Id<"items"> };

type Props = {
	isOpen: boolean;
	onClose: () => void;
	inventoryItems: Doc<"items">[];
	stashItems: Doc<"items">[];
	onDeposit: (
		itemIds: Id<"items">[],
	) => Promise<{ deposited: number; failed: number }>;
	onWithdraw: (
		itemIds: Id<"items">[],
	) => Promise<{ withdrawn: number; failed: number }>;
	onReorderInventory: (args: {
		itemId: Id<"items">;
		targetSlot: number;
		swapWithItemId?: Id<"items">;
	}) => void;
	onReorderStash: (args: { itemId: Id<"items">; targetSlot: number; swapWithItemId?: Id<"items"> }) => void;
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
	const [invSelected, setInvSelected] = useState<Set<string>>(new Set());
	const [stashSelected, setStashSelected] = useState<Set<string>>(new Set());
	const [isDepositing, runDeposit] = useInFlight(isOpen);
	const [isWithdrawing, runWithdraw] = useInFlight(isOpen);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
	);

	useEffect(() => {
		if (!isOpen) return;
		setInvSelected(new Set());
		setStashSelected(new Set());
	}, [isOpen]);

	const inventoryBySlot = useMemo(() => {
		const map = new Map<number, Doc<"items">>();
		for (const item of inventoryItems) {
			if (typeof item.inventorySlot === "number")
				map.set(item.inventorySlot, item);
		}
		return map;
	}, [inventoryItems]);

	const stashBySlot = useMemo(() => {
		const map = new Map<number, Doc<"items">>();
		for (const item of stashItems) {
			if (typeof item.stashSlot === "number") map.set(item.stashSlot, item);
		}
		return map;
	}, [stashItems]);

	const invFree = Math.max(0, INVENTORY_MAX_SLOTS - inventoryItems.length);
	const stashFree = Math.max(0, STASH_MAX_SLOTS - stashItems.length);

	const activeItem = useMemo<GeneratedItem | null>(() => {
		if (!active) return null;
		if (active.kind === "inventory") {
			return (
				inventoryItems.find((it) => it._id === active.itemId)?.data ?? null
			);
		}
		return stashItems.find((it) => it._id === active.itemId)?.data ?? null;
	}, [active, inventoryItems, stashItems]);

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

		// Same panel reorder
		if (source.kind === "inventory" && target.kind === "inventory") {
			const doc = inventoryItems.find((it) => it._id === source.itemId);
			if (!doc || doc.inventorySlot === target.slot) return;
			const occupant = inventoryItems.find((it) => it.inventorySlot === target.slot && it._id !== source.itemId);
			onReorderInventory({
				itemId: source.itemId,
				targetSlot: target.slot,
				swapWithItemId: occupant?._id,
			});
			return;
		}
		if (source.kind === "stash" && target.kind === "stash") {
			const doc = stashItems.find((it) => it._id === source.itemId);
			if (!doc || doc.stashSlot === target.slot) return;
			const stashOccupant = stashItems.find((it) => it.stashSlot === target.slot && it._id !== source.itemId);
			onReorderStash({ itemId: source.itemId, targetSlot: target.slot, swapWithItemId: stashOccupant?._id });
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

	const handleShiftClickInv = async (itemId: Id<"items">) => {
		try {
			const result = await onDeposit([itemId]);
			if (result.failed > 0) toast.error(m.stash_full_error());
		} catch (err) {
			toast.error(err instanceof Error ? err.message : m.stash_full_error());
		}
	};

	const handleShiftClickStash = async (itemId: Id<"items">) => {
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
			.filter((it) => invSelected.has(it._id.toString()))
			.map((it) => it._id);
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
			.filter((it) => stashSelected.has(it._id.toString()))
			.map((it) => it._id);
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

	const toggleInv = (id: string) => {
		setInvSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const toggleStash = (id: string) => {
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
			setInvSelected(new Set(inventoryItems.map((it) => it._id.toString())));
		}
	};

	const toggleAllStash = () => {
		if (stashSelected.size === stashItems.length && stashItems.length > 0) {
			setStashSelected(new Set());
		} else {
			setStashSelected(new Set(stashItems.map((it) => it._id.toString())));
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
											// biome-ignore lint/suspicious/noArrayIndexKey: fixed grid, slot index IS the identity
											key={`inv-${slot}`}
											droppableId={`inv-${slot}`}
											kind="inventory"
											slot={slot}
											item={item}
											dragKind="inventory"
											isDraggingThis={
												active?.kind === "inventory" &&
												item?._id === active.itemId
											}
											isSelected={
												item ? invSelected.has(item._id.toString()) : false
											}
											onItemClick={(itemId, shiftKey) => {
												if (shiftKey) {
													void handleShiftClickInv(itemId);
												} else {
													toggleInv(itemId.toString());
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
												// biome-ignore lint/suspicious/noArrayIndexKey: fixed grid, slot index IS the identity
												key={`stash-${slot}`}
												droppableId={`stash-${slot}`}
												kind="stash"
												slot={slot}
												item={item}
												dragKind="stash"
												isDraggingThis={
													active?.kind === "stash" &&
													item?._id === active.itemId
												}
												isSelected={
													item ? stashSelected.has(item._id.toString()) : false
												}
												onItemClick={(itemId, shiftKey) => {
													if (shiftKey) {
														void handleShiftClickStash(itemId);
													} else {
														toggleStash(itemId.toString());
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
	item: Doc<"items"> | null;
	dragKind: "inventory" | "stash";
	isDraggingThis: boolean;
	isSelected: boolean;
	onItemClick: (itemId: Id<"items">, shiftKey: boolean) => void;
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
	item: Doc<"items">;
	dragKind: "inventory" | "stash";
	hidden: boolean;
	onClick: (itemId: Id<"items">, shiftKey: boolean) => void;
	slotSize: number;
}) {
	const handle = useDraggable({
		id: `${dragKind}-${item._id}`,
		data: { kind: dragKind, itemId: item._id } satisfies DragSourceData,
	});
	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: dnd-kit handles keyboard via handle.attributes
		// biome-ignore lint/a11y/noStaticElementInteractions: dnd-kit manages accessibility via handle.attributes
		<div
			ref={handle.setNodeRef}
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
							onClick(item._id, e.shiftKey);
						}
			}
			{...handle.listeners}
			{...handle.attributes}
		>
			<ItemCard item={item.data} size={slotSize} suppressTooltip={hidden} />
		</div>
	);
}

function asDragSource(d: unknown): DragSourceData | undefined {
	if (!d || typeof d !== "object") return undefined;
	const obj = d as Record<string, unknown>;
	const itemId = obj.itemId;
	if (typeof itemId !== "string") return undefined;
	if (obj.kind === "inventory") {
		return { kind: "inventory", itemId: itemId as Id<"items"> };
	}
	if (obj.kind === "stash") {
		return { kind: "stash", itemId: itemId as Id<"items"> };
	}
	return undefined;
}

function asDropTarget(d: unknown): DropTargetData | undefined {
	if (!d || typeof d !== "object") return undefined;
	const obj = d as Record<string, unknown>;
	if (
		(obj.kind === "inventory" || obj.kind === "stash") &&
		typeof obj.slot === "number"
	) {
		return { kind: obj.kind, slot: obj.slot };
	}
	return undefined;
}
