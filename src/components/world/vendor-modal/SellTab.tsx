import ItemCard from "#/components/game/ItemCard";
import RubyIcon from "#/components/game/RubyIcon";
import { Button } from "#/components/ui/button";
import type { ItemRow } from "#/lib/api-types";
import { m } from "#/paraglide/messages";

const ITEM_SLOT_SIZE = 88;

export default function SellTab({
	inventoryItems,
	selected,
	selectedCount,
	selectedTotal,
	isSelling,
	onToggle,
	onToggleAll,
	onSell,
}: {
	inventoryItems: readonly ItemRow[];
	selected: ReadonlySet<number>;
	selectedCount: number;
	selectedTotal: number;
	isSelling: boolean;
	onToggle: (id: number) => void;
	onToggleAll: () => void;
	onSell: () => Promise<void>;
}) {
	if (inventoryItems.length === 0) {
		return (
			<p className="flex-1 py-12 text-center text-sm text-white/40">
				{m.vendor_sell_empty()}
			</p>
		);
	}

	return (
		<div className="flex flex-1 flex-col gap-4">
			<div className="flex justify-end">
				<Button
					type="button"
					variant="starkText"
					size="inline"
					onClick={onToggleAll}
					className="display-title px-2 py-1 text-sm font-normal uppercase tracking-[0.2em]"
				>
					{selectedCount === inventoryItems.length
						? m.vendor_sell_deselect_all()
						: m.vendor_sell_select_all()}
				</Button>
			</div>
			<div className="fancy-scroll flex max-h-[50vh] min-h-[20vh] flex-1 flex-wrap content-start gap-3 overflow-y-auto pr-3">
				{inventoryItems.map((item) => (
					<ItemCard
						key={item.id}
						item={item.data}
						size={ITEM_SLOT_SIZE}
						selected={selected.has(item.id)}
						onClick={() => onToggle(item.id)}
					/>
				))}
			</div>
			<div className="flex items-center justify-between border-t border-white/15 pt-3">
				<div className="display-title text-sm uppercase tracking-wider text-white/70">
					{selectedCount > 0 ? (
						<span className="flex items-center gap-2">
							<span>{m.vendor_sell_selected({ count: selectedCount })}</span>
							<span className="flex items-center gap-1 text-yellow-300 tabular-nums">
								<RubyIcon className="h-4 w-4" />
								{selectedTotal}
							</span>
						</span>
					) : (
						<span className="text-white/40">{m.vendor_sell_pick_items()}</span>
					)}
				</div>
				<Button
					type="button"
					variant="starkMuted"
					size="lg"
					onClick={onSell}
					disabled={selectedCount === 0 || isSelling}
					className="px-8 text-base uppercase tracking-wider"
				>
					{m.vendor_sell_action()}
				</Button>
			</div>
		</div>
	);
}
