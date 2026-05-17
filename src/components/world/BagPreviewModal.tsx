import ItemCard from "#/components/game/ItemCard";
import Modal from "#/components/Modal";
import { Button } from "#/components/ui/button";
import { m } from "#/paraglide/messages";
import type { Doc } from "../../../convex/_generated/dataModel";

const ITEM_SLOT_SIZE = 96;

type Props = {
	isOpen: boolean;
	onClose: () => void;
	items: Doc<"items">[];
};

export default function BagPreviewModal({ isOpen, onClose, items }: Props) {
	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={m.loot_title({ count: items.length })}
			className="max-w-4xl"
		>
			{items.length === 0 ? (
				<p className="py-8 text-center text-sm text-white/40">
					{m.loot_bag_empty_combat()}
				</p>
			) : (
				<div className="fancy-scroll flex max-h-[60vh] flex-wrap gap-3 overflow-y-auto pr-3">
					{items.map((item) => (
						<ItemCard key={item._id} item={item.data} size={ITEM_SLOT_SIZE} />
					))}
				</div>
			)}
			<div className="mt-4 flex justify-end">
				<Button
					type="button"
					variant="stark"
					onClick={onClose}
					className="px-5 py-2 uppercase tracking-wider"
				>
					{m.loot_close_button()}
				</Button>
			</div>
		</Modal>
	);
}
