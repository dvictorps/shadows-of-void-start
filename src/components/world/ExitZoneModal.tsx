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
}: Props) {
	// Selection defaults empty each time the modal opens. Toggling fills the set.
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const confirm = useConfirmationModal();

	useEffect(() => {
		if (!isOpen) return;
		setSelected(new Set());
	}, [isOpen]);

	const toggle = (id: string) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const selectedCount = selected.size;
	const hasSelection = selectedCount > 0;
	const hasItems = bagItems.length > 0;

	const selectedIds = (): Id<"items">[] =>
		bagItems
			.filter((it) => selected.has(it._id.toString()))
			.map((it) => it._id);

	const handlePickSelected = async () => {
		if (!hasSelection) return;
		await onPickSelected(selectedIds());
	};

	const handleDiscardSelected = async () => {
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
		await onDiscardSelected(ids);
	};

	const handlePickAll = async () => {
		if (!hasItems) return;
		await onPickAll(bagItems.map((it) => it._id));
	};

	const handleDiscardAll = async () => {
		if (!hasItems) return;
		const ok = await confirm({
			title: m.loot_discard_all_title(),
			message: discardMessage(bagItems.length),
			confirmLabel: m.loot_discard_confirm_button(),
			cancelLabel: m.loot_back_button(),
			variant: "destructive",
		});
		if (!ok) return;
		await onDiscardAll();
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={m.loot_found_title()}
			className="max-w-4xl"
		>
			<div className="space-y-6">
				{hasItems ? (
					<div className="fancy-scroll flex max-h-[55vh] min-h-[20vh] flex-wrap content-start gap-3 overflow-y-auto pr-3">
						{bagItems.map((item) => {
							const isSelected = selected.has(item._id.toString());
							return (
								<ItemCard
									key={item._id}
									item={item.data}
									size={ITEM_SLOT_SIZE}
									dimmed={!isSelected}
									onClick={() => toggle(item._id.toString())}
								/>
							);
						})}
					</div>
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
							disabled={!hasSelection}
							className="px-5 py-2 uppercase tracking-wider"
						>
							{m.loot_pick_selected_button({ count: selectedCount })}
						</Button>
						<Button
							type="button"
							variant="starkMuted"
							onClick={handleDiscardSelected}
							disabled={!hasSelection}
							className="px-5 py-2 uppercase tracking-wider"
						>
							{m.loot_discard_selected_button({ count: selectedCount })}
						</Button>
					</div>
					<div className="flex flex-wrap items-center justify-center gap-3">
						<Button
							type="button"
							variant="stark"
							onClick={handleDiscardAll}
							disabled={!hasItems}
							className="px-5 py-2 uppercase tracking-wider"
						>
							{m.loot_discard_all_button()}
						</Button>
						<Button
							type="button"
							variant="stark"
							onClick={handlePickAll}
							disabled={!hasItems}
							className="px-5 py-2 uppercase tracking-wider"
						>
							{m.loot_pick_all_button()}
						</Button>
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
