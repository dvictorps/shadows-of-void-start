import { useMemo, useState } from "react";

import ItemCard from "#/components/game/ItemCard";
import Modal from "#/components/Modal";
import { Button } from "#/components/ui/button";
import { useConfirmationModal } from "#/hooks/useConfirmationModal";
import { useInFlight } from "#/hooks/useInFlight";
import { useOpenedEdge } from "#/hooks/useOpenedEdge";
import type { BagEntry } from "#/lib/api-types";
import { m } from "#/paraglide/messages";

const ITEM_SLOT_SIZE = 96;

type Props = {
	isOpen: boolean;
	onClose: () => void;
	onPickSelected: (ids: string[]) => void | Promise<void>;
	onDiscardSelected: (ids: string[]) => void | Promise<void>;
	onPickAll: (ids: string[]) => void | Promise<void>;
	onDiscardAll: () => void | Promise<void>;
	bagItems: BagEntry[];
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
	const [rawSelected, setSelected] = useState<Set<string>>(new Set());
	const justOpened = useOpenedEdge(isOpen);
	if (justOpened) setSelected(new Set());
	const selected = useMemo(() => {
		const present = new Set(bagItems.map((it) => it.bagId));
		const next = new Set([...rawSelected].filter((id) => present.has(id)));
		return next.size === rawSelected.size ? rawSelected : next;
	}, [rawSelected, bagItems]);
	const [isPickingSelected, runPickSelected] = useInFlight(isOpen);
	const [isDiscardingSelected, runDiscardSelected] = useInFlight(isOpen);
	const [isPickingAll, runPickAll] = useInFlight(isOpen);
	const [isDiscardingAll, runDiscardAll] = useInFlight(isOpen);
	const confirm = useConfirmationModal();

	const selectedCount = selected.size;
	const hasSelection = selectedCount > 0;
	const hasItems = bagItems.length > 0;
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

	const selectedIds = (): string[] =>
		bagItems.filter((it) => selected.has(it.bagId)).map((it) => it.bagId);

	const handlePickSelected = () => {
		if (!hasSelection) return;
		return runPickSelected(() =>
			Promise.resolve(onPickSelected(selectedIds())),
		);
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
		await runDiscardSelected(() => Promise.resolve(onDiscardSelected(ids)));
	};

	const handlePickAll = () => {
		if (!hasItems) return;
		if (isCapped) return;
		return runPickAll(() =>
			Promise.resolve(onPickAll(bagItems.map((it) => it.bagId))),
		);
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
		await runDiscardAll(() => Promise.resolve(onDiscardAll()));
	};

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
						<div className="fancy-scroll flex max-h-148.5 min-h-54 flex-wrap content-start gap-3 overflow-y-auto pr-3">
							{bagItems.map((item) => {
								const isSelected = selected.has(item.bagId);
								return (
									<ItemCard
										key={item.bagId}
										item={item.data}
										size={ITEM_SLOT_SIZE}
										selected={isSelected}
										dimmed={atCap && !isSelected}
										onClick={() => toggle(item.bagId)}
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
