import { Gem } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import ItemCard from "#/components/game/ItemCard";
import Modal from "#/components/Modal";
import { Button } from "#/components/ui/button";
import { computeSellPrice } from "#/game/items/sell-price";
import { VENDOR_PRODUCTS, type VendorProductId } from "#/game/vendor/products";
import { m } from "#/paraglide/messages";
import type { Doc, Id } from "../../../convex/_generated/dataModel";

const ITEM_SLOT_SIZE = 88;

type Tab = "buy" | "sell";

type Props = {
	isOpen: boolean;
	onClose: () => void;
	rubys: number;
	inventoryItems: Doc<"items">[];
	onBuy: (productId: VendorProductId) => Promise<void>;
	onSell: (itemId: Id<"items">) => Promise<void>;
};

export default function VendorModal({
	isOpen,
	onClose,
	rubys,
	inventoryItems,
	onBuy,
	onSell,
}: Props) {
	const [tab, setTab] = useState<Tab>("buy");
	const [selectedSellId, setSelectedSellId] = useState<string | null>(null);

	const handleBuy = async (productId: VendorProductId) => {
		try {
			await onBuy(productId);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : m.vendor_buy_failed());
		}
	};

	const handleSell = async () => {
		if (!selectedSellId) return;
		const item = inventoryItems.find((it) => it._id === selectedSellId);
		if (!item) return;
		try {
			await onSell(item._id);
			setSelectedSellId(null);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : m.vendor_sell_failed());
		}
	};

	const selectedItem = selectedSellId
		? inventoryItems.find((it) => it._id === selectedSellId)
		: null;

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={m.vendor_title()}
			className="max-w-4xl"
		>
			<div className="space-y-4">
				{/* Ruby balance + tabs */}
				<div className="flex items-center justify-between border-b border-white/15 pb-3">
					<div className="display-title flex items-center gap-1.5 text-base uppercase tracking-wider text-white">
						<Gem className="h-4 w-4 text-rose-400" strokeWidth={2} />
						<span className="tabular-nums">{rubys}</span>
					</div>
					<div className="flex gap-1 border border-white/20 p-0.5">
						<TabButton active={tab === "buy"} onClick={() => setTab("buy")}>
							{m.vendor_tab_buy()}
						</TabButton>
						<TabButton
							active={tab === "sell"}
							onClick={() => setTab("sell")}
						>
							{m.vendor_tab_sell()}
						</TabButton>
					</div>
				</div>

				{/* Tab content */}
				{tab === "buy" && (
					<BuyTab rubys={rubys} onBuy={handleBuy} />
				)}
				{tab === "sell" && (
					<SellTab
						inventoryItems={inventoryItems}
						selectedSellId={selectedSellId}
						setSelectedSellId={setSelectedSellId}
						selectedItem={selectedItem ?? null}
						onSell={handleSell}
					/>
				)}
			</div>
		</Modal>
	);
}

function TabButton({
	active,
	onClick,
	children,
}: {
	active: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`px-4 py-1.5 font-medium text-xs uppercase tracking-wider transition ${
				active
					? "bg-white text-black"
					: "text-white/70 hover:bg-white/10 hover:text-white"
			}`}
		>
			{children}
		</button>
	);
}

function BuyTab({
	rubys,
	onBuy,
}: {
	rubys: number;
	onBuy: (productId: VendorProductId) => Promise<void>;
}) {
	const products = Object.values(VENDOR_PRODUCTS);
	return (
		<div className="space-y-2">
			{products.map((p) => {
				const canAfford = rubys >= p.priceRubys;
				return (
					<div
						key={p.id}
						className="flex items-center justify-between rounded-md border border-white/20 bg-black/40 px-4 py-3"
					>
						<div className="flex items-center gap-3">
							<span className="text-2xl">{productEmoji(p.id)}</span>
							<div className="display-title text-sm uppercase tracking-wider text-white">
								{productLabel(p.id)}
							</div>
						</div>
						<div className="flex items-center gap-3">
							<span className="display-title flex items-center gap-1 text-sm tabular-nums tracking-wider text-yellow-300">
								<Gem className="h-3.5 w-3.5 text-rose-400" strokeWidth={2} />
								{p.priceRubys}
							</span>
							<Button
								type="button"
								variant="starkMuted"
								onClick={() => onBuy(p.id)}
								disabled={!canAfford}
								className="px-4 py-1.5 text-xs uppercase tracking-wider"
							>
								{m.vendor_buy_action()}
							</Button>
						</div>
					</div>
				);
			})}
		</div>
	);
}

function SellTab({
	inventoryItems,
	selectedSellId,
	setSelectedSellId,
	selectedItem,
	onSell,
}: {
	inventoryItems: Doc<"items">[];
	selectedSellId: string | null;
	setSelectedSellId: (id: string | null) => void;
	selectedItem: Doc<"items"> | null;
	onSell: () => Promise<void>;
}) {
	if (inventoryItems.length === 0) {
		return (
			<p className="py-12 text-center text-sm text-white/40">
				{m.vendor_sell_empty()}
			</p>
		);
	}

	const price = selectedItem ? computeSellPrice(selectedItem.data) : 0;

	return (
		<div className="space-y-4">
			<div className="fancy-scroll flex max-h-[50vh] min-h-[20vh] flex-wrap content-start gap-3 overflow-y-auto pr-3">
				{inventoryItems.map((item) => {
					const isSelected = selectedSellId === item._id.toString();
					return (
						<ItemCard
							key={item._id}
							item={item.data}
							size={ITEM_SLOT_SIZE}
							selected={isSelected}
							onClick={() =>
								setSelectedSellId(
									isSelected ? null : item._id.toString(),
								)
							}
						/>
					);
				})}
			</div>
			<div className="flex items-center justify-between border-t border-white/15 pt-3">
				<div className="display-title flex items-center gap-1.5 text-sm uppercase tracking-wider text-white/80">
					{selectedItem ? (
						<>
							<span>{m.vendor_sell_preview()}</span>
							<span className="flex items-center gap-1 text-yellow-300 tabular-nums">
								<Gem className="h-3.5 w-3.5 text-rose-400" strokeWidth={2} />
								{price}
							</span>
						</>
					) : (
						<span className="text-white/40">
							{m.vendor_sell_pick_an_item()}
						</span>
					)}
				</div>
				<Button
					type="button"
					variant="starkMuted"
					onClick={onSell}
					disabled={!selectedItem}
					className="px-4 py-1.5 text-xs uppercase tracking-wider"
				>
					{m.vendor_sell_action()}
				</Button>
			</div>
		</div>
	);
}

function productLabel(id: VendorProductId): string {
	switch (id) {
		case "potion":
			return m.vendor_product_potion();
		default:
			return id;
	}
}

function productEmoji(id: VendorProductId): string {
	switch (id) {
		case "potion":
			return "🧪";
		default:
			return "❓";
	}
}
