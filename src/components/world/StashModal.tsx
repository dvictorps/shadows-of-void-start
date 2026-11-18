import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	type DragStartEvent,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import StageDragOverlay from "#/components/game-stage/StageDragOverlay";
import ItemCard from "#/components/game/ItemCard";
import Modal from "#/components/Modal";
import { Button } from "#/components/ui/button";
import {
	INVENTORY_MAX_SLOTS,
	STASH_MAX_SLOTS,
} from "#/game/inventory/constants";
import type { GeneratedItem } from "#/game/items/types";
import { useEscapeLayer } from "#/hooks/useEscapeLayer";
import { useInFlight } from "#/hooks/useInFlight";
import { useOpenedEdge } from "#/hooks/useOpenedEdge";
import type { ItemRow } from "#/lib/api-types";
import { serverErrorMessage } from "#/lib/server-error-message";
import { m } from "#/paraglide/messages";

import { toggleAll, toggleId } from "./item-selection";
import {
	type DragSourceData,
	isDragSource,
	isDropTarget,
	resolveStashDrop,
	type StashMove,
	type StashSide,
} from "./stash-modal/drag";
import StashPanel from "./stash-modal/StashPanel";

const SLOT_SIZE = 76;

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
	onReorderInventory: (move: StashMove) => void;
	onReorderStash: (move: StashMove) => void;
};

type Transfer = "deposit" | "withdraw";

const FULL_MESSAGE = {
	deposit: () => m.stash_full_error(),
	withdraw: () => m.inventory_full_error(),
} satisfies Record<Transfer, () => string>;

const FAILED_MESSAGE = {
	deposit: () => m.error_deposit_failed(),
	withdraw: () => m.error_withdraw_failed(),
} satisfies Record<Transfer, () => string>;

const emptySelection = () => new Set<number>();

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
	const [active, setActive] = useState<DragSourceData | null>(null);
	useEscapeLayer(active !== null);
	const [invSelected, setInvSelected] = useState(emptySelection);
	const [stashSelected, setStashSelected] = useState(emptySelection);
	const [isDepositing, runDeposit] = useInFlight(isOpen);
	const [isWithdrawing, runWithdraw] = useInFlight(isOpen);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
	);

	const justOpened = useOpenedEdge(isOpen);
	if (justOpened) {
		setInvSelected(emptySelection());
		setStashSelected(emptySelection());
	}

	const sides = {
		inventory: {
			direction: "deposit",
			items: inventoryItems,
			selected: invSelected,
			setSelected: setInvSelected,
			run: runDeposit,
		},
		stash: {
			direction: "withdraw",
			items: stashItems,
			selected: stashSelected,
			setSelected: setStashSelected,
			run: runWithdraw,
		},
	} as const;

	const activeItem = useMemo<GeneratedItem | null>(() => {
		if (!active) return null;
		const items = active.kind === "inventory" ? inventoryItems : stashItems;
		return items.find((it) => it.id === active.itemId)?.data ?? null;
	}, [active, inventoryItems, stashItems]);

	const transferOne = async (direction: Transfer, itemId: number) => {
		try {
			const { failed } = await (direction === "deposit"
				? onDeposit([itemId])
				: onWithdraw([itemId]));
			if (failed > 0) toast.error(FULL_MESSAGE[direction]());
		} catch (err) {
			toast.error(serverErrorMessage(err, FAILED_MESSAGE[direction]()));
		}
	};

	const transferMany = async (
		direction: Transfer,
		ids: number[],
	): Promise<string | null> => {
		if (direction === "deposit") {
			const { deposited, failed } = await onDeposit(ids);
			return failed > 0 ? m.stash_deposit_result({ deposited, failed }) : null;
		}
		const { withdrawn, failed } = await onWithdraw(ids);
		return failed > 0 ? m.stash_withdraw_result({ withdrawn, failed }) : null;
	};

	const transferSelected = async (side: StashSide) => {
		const { direction, items, selected, setSelected, run } = sides[side];
		const ids = items.filter((it) => selected.has(it.id)).map((it) => it.id);
		if (ids.length === 0) return;
		const previous = new Set(selected);
		await run(async () => {
			setSelected(emptySelection());
			try {
				const partial = await transferMany(direction, ids);
				if (partial) toast(partial);
			} catch (err) {
				setSelected(previous);
				toast.error(serverErrorMessage(err, FAILED_MESSAGE[direction]()));
			}
		});
	};

	const handleItemClick =
		(side: StashSide) => (itemId: number, shiftKey: boolean) => {
			const { direction, setSelected } = sides[side];
			if (shiftKey) void transferOne(direction, itemId);
			else setSelected((prev) => toggleId(prev, itemId));
		};

	const handleToggleAll = (side: StashSide) => () => {
		const { items, setSelected } = sides[side];
		setSelected((prev) => toggleAll(prev, items));
	};

	const handleDragStart = (event: DragStartEvent) => {
		const data = event.active.data.current;
		if (isDragSource(data)) setActive(data);
	};

	const handleDragEnd = async (event: DragEndEvent) => {
		const source = event.active.data.current;
		const target = event.over?.data.current;
		setActive(null);
		if (!isDragSource(source) || !isDropTarget(target)) return;
		const action = resolveStashDrop(source, target, inventoryItems, stashItems);
		if (!action) return;
		switch (action.kind) {
			case "reorderInventory":
				onReorderInventory(action.move);
				return;
			case "reorderStash":
				onReorderStash(action.move);
				return;
			case "deposit":
			case "withdraw":
				await transferOne(action.kind, action.itemId);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={m.stash_title({ used: stashItems.length, total: STASH_MAX_SLOTS })}
			className="max-w-[1440px]"
			hideHeaderClose
			footer={
				<div className="flex items-center justify-between">
					<div className="flex gap-3">
						{invSelected.size > 0 && (
							<Button
								type="button"
								variant="starkMuted"
								size="lg"
								onClick={() => transferSelected("inventory")}
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
								onClick={() => transferSelected("stash")}
								disabled={isWithdrawing}
								className="text-sm uppercase tracking-wider"
							>
								{m.stash_withdraw_selected()} ({stashSelected.size})
							</Button>
						)}
					</div>
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
				onDragCancel={() => setActive(null)}
			>
				<div className="flex gap-4">
					<StashPanel
						side="inventory"
						header={m.stash_inventory_header()}
						freeLabel={(count) =>
							count === 1
								? m.inventory_free_slot_one({ count })
								: m.inventory_free_slot_other({ count })
						}
						items={inventoryItems}
						maxSlots={INVENTORY_MAX_SLOTS}
						selected={invSelected}
						dragging={active}
						slotSize={SLOT_SIZE}
						onToggleAll={handleToggleAll("inventory")}
						onItemClick={handleItemClick("inventory")}
					/>

					<div className="w-px bg-white/15" aria-hidden />

					<StashPanel
						side="stash"
						header={m.stash_header()}
						freeLabel={(count) =>
							count === 1
								? m.stash_free_slot_one({ count })
								: m.stash_free_slot_other({ count })
						}
						emptyLabel={m.stash_empty()}
						items={stashItems}
						maxSlots={STASH_MAX_SLOTS}
						selected={stashSelected}
						dragging={active}
						slotSize={SLOT_SIZE}
						onToggleAll={handleToggleAll("stash")}
						onItemClick={handleItemClick("stash")}
					/>
				</div>

				<StageDragOverlay>
					{activeItem ? (
						<ItemCard item={activeItem} size={SLOT_SIZE} suppressTooltip />
					) : null}
				</StageDragOverlay>
			</DndContext>
		</Modal>
	);
}
