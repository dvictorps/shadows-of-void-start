import { useEffect, useState } from "react";
import ItemCard from "#/components/game/ItemCard";
import Modal from "#/components/Modal";
import { Button } from "#/components/ui/button";
import { useConfirmationModal } from "#/hooks/useConfirmationModal";
import { m } from "#/paraglide/messages";
import type { Doc, Id } from "../../../convex/_generated/dataModel";

const ITEM_SLOT_SIZE = 96;

type Props = {
	isOpen: boolean;
	onClose: () => void;
	onPickSelected: (ids: Id<"items">[]) => void | Promise<void>;
	onDiscardSelected: (ids: Id<"items">[]) => void | Promise<void>;
	onPickAll: (ids: Id<"items">[]) => void | Promise<void>;
	onDiscardAll: () => void | Promise<void>;
	bagItems: Doc<"items">[];
	// Maximum number of items the player can mark "keep". Camp/boss exits
	// pass bagItems.length (no cap); exploração/combate retreats pass
	// floor(bagItems.length × 0.3) min 1 (the 30% punishment tier).
	// See CONTEXT.md → Bag retention tiers.
	keepCap: number;
};

function discardMessage(count: number): string {
	return count === 1
		? m.loot_discard_message_one({ count })
		: m.loot_discard_message_other({ count });
}

export default function ExitZoneModal({
	isOpen,
	onClose,
	onPickSelected,
	onDiscardSelected,
	onPickAll,
	onDiscardAll,
	bagItems,
	keepCap,
}: Props) {
	// Selection defaults empty each time the modal opens. Toggling fills the set.
	const [selected, setSelected] = useState<Set<string>>(new Set());
	// In-flight tracking for the four action handlers. Modal-close on the
	// success path already covers the most common spam-click case, but a
	// slow round-trip would leave the buttons live until the close fires —
	// hence the early-return + try/finally + disabled-button trio. Mirrors the
	// VendorModal pattern from PR #45.
	const [isPickingSelected, setIsPickingSelected] = useState(false);
	const [isDiscardingSelected, setIsDiscardingSelected] = useState(false);
	const [isPickingAll, setIsPickingAll] = useState(false);
	const [isDiscardingAll, setIsDiscardingAll] = useState(false);
	const confirm = useConfirmationModal();

	useEffect(() => {
		if (!isOpen) {
			// Reset on natural close boundary so a slow request finishing
			// mid-close doesn't leave the next open with stale disabled state.
			setIsPickingSelected(false);
			setIsDiscardingSelected(false);
			setIsPickingAll(false);
			setIsDiscardingAll(false);
			return;
		}
		setSelected(new Set());
	}, [isOpen]);

	// Auto-close after a partial pick/discard empties the bag. The modal only
	// opens with items > 0, so an empty bagItems here always means the user
	// just cleared it via a selection action.
	useEffect(() => {
		if (isOpen && bagItems.length === 0) onClose();
	}, [isOpen, bagItems.length, onClose]);

	const selectedCount = selected.size;
	const hasSelection = selectedCount > 0;
	const hasItems = bagItems.length > 0;
	// Cap only bites when it's below the full bag — at camp / boss exits
	// keepCap equals bagItems.length and the UI flows as before.
	const isCapped = keepCap < bagItems.length;
	const atCap = selectedCount >= keepCap;

	const toggle = (id: string) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else if (!atCap) {
				next.add(id);
			}
			return next;
		});
	};

	const selectedIds = (): Id<"items">[] =>
		bagItems
			.filter((it) => selected.has(it._id.toString()))
			.map((it) => it._id);

	const handlePickSelected = async () => {
		if (isPickingSelected) return;
		if (!hasSelection) return;
		setIsPickingSelected(true);
		try {
			await onPickSelected(selectedIds());
		} finally {
			setIsPickingSelected(false);
		}
	};

	const handleDiscardSelected = async () => {
		if (isDiscardingSelected) return;
		if (!hasSelection) return;
		const ids = selectedIds();
		const ok = await confirm({
			title: m.loot_discard_all_title(),
			message: discardMessage(ids.length),
			confirmLabel: m.loot_discard_confirm_button(),
			cancelLabel: m.loot_back_button(),
			variant: "destructive",
		});
		if (!ok) return;
		setIsDiscardingSelected(true);
		try {
			await onDiscardSelected(ids);
		} finally {
			setIsDiscardingSelected(false);
		}
	};

	const handlePickAll = async () => {
		if (isPickingAll) return;
		if (!hasItems) return;
		// Belt-and-suspenders — the button is hidden when isCapped, but a
		// future regression here can't bypass the 30% cap.
		if (isCapped) return;
		setIsPickingAll(true);
		try {
			await onPickAll(bagItems.map((it) => it._id));
		} finally {
			setIsPickingAll(false);
		}
	};

	const handleDiscardAll = async () => {
		if (isDiscardingAll) return;
		if (!hasItems) return;
		const ok = await confirm({
			title: m.loot_discard_all_title(),
			message: discardMessage(bagItems.length),
			confirmLabel: m.loot_discard_confirm_button(),
			cancelLabel: m.loot_back_button(),
			variant: "destructive",
		});
		if (!ok) return;
		setIsDiscardingAll(true);
		try {
			await onDiscardAll();
		} finally {
			setIsDiscardingAll(false);
		}
	};

	// Any action in-flight disables sibling buttons too so the user can't
	// queue overlapping mutations (pick-all while discard-all is mid-flight).
	const anyActionPending =
		isPickingSelected ||
		isDiscardingSelected ||
		isPickingAll ||
		isDiscardingAll;

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={m.loot_found_title()}
			className="max-w-4xl"
		>
			<div className="space-y-6">
				{hasItems ? (
					<>
						{isCapped && (
							<p className="text-center text-xs uppercase tracking-wider text-yellow-300/80">
								{m.loot_keep_cap_hint({
									selected: selectedCount,
									cap: keepCap,
								})}
							</p>
						)}
						<div className="fancy-scroll flex max-h-[55vh] min-h-[20vh] flex-wrap content-start gap-3 overflow-y-auto pr-3">
							{bagItems.map((item) => {
								const isSelected = selected.has(item._id.toString());
								return (
									<ItemCard
										key={item._id}
										item={item.data}
										size={ITEM_SLOT_SIZE}
										selected={isSelected}
										dimmed={atCap && !isSelected}
										onClick={() => toggle(item._id.toString())}
									/>
								);
							})}
						</div>
					</>
				) : (
					<p className="py-12 text-center text-sm text-white/40">
						{m.loot_bag_empty_run()}
					</p>
				)}

				<div className="flex flex-col items-center gap-3 border-t border-white/15 pt-5">
					<div className="flex flex-wrap items-center justify-center gap-3">
						<Button
							type="button"
							variant="starkMuted"
							onClick={handlePickSelected}
							disabled={!hasSelection || anyActionPending}
							className="px-5 py-2 uppercase tracking-wider"
						>
							{m.loot_pick_selected_button({ count: selectedCount })}
						</Button>
						{!isCapped && (
							<Button
								type="button"
								variant="starkMuted"
								onClick={handleDiscardSelected}
								disabled={!hasSelection || anyActionPending}
								className="px-5 py-2 uppercase tracking-wider"
							>
								{m.loot_discard_selected_button({ count: selectedCount })}
							</Button>
						)}
					</div>
					<div className="flex flex-wrap items-center justify-center gap-3">
						<Button
							type="button"
							variant="stark"
							onClick={handleDiscardAll}
							disabled={!hasItems || anyActionPending}
							className="px-5 py-2 uppercase tracking-wider"
						>
							{m.loot_discard_all_button()}
						</Button>
						{!isCapped && (
							<Button
								type="button"
								variant="stark"
								onClick={handlePickAll}
								disabled={!hasItems || anyActionPending}
								className="px-5 py-2 uppercase tracking-wider"
							>
								{m.loot_pick_all_button()}
							</Button>
						)}
						<Button
							type="button"
							variant="stark"
							onClick={onClose}
							className="px-5 py-2 uppercase tracking-wider"
						>
							{m.loot_close_button()}
						</Button>
					</div>
				</div>
			</div>
		</Modal>
	);
}
