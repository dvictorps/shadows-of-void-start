import { AnimatePresence, motion } from "framer-motion";
import { Gem } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
	potions: number;
	teleportStones: number;
	windCrystals: number;
	inventoryItems: Doc<"items">[];
	onBuy: (productId: VendorProductId) => Promise<void>;
	onSellMany: (itemIds: Id<"items">[]) => Promise<void>;
};

type RubyDelta = { id: string; amount: number; sign: "+" | "-" };

const RUBY_DELTA_LIFETIME_MS = 1200;

export default function VendorModal({
	isOpen,
	onClose,
	rubys,
	potions,
	teleportStones,
	windCrystals,
	inventoryItems,
	onBuy,
	onSellMany,
}: Props) {
	const [tab, setTab] = useState<Tab>("buy");
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [rubyDeltas, setRubyDeltas] = useState<RubyDelta[]>([]);

	useEffect(() => {
		if (!isOpen) return;
		setSelected(new Set());
		setRubyDeltas([]);
	}, [isOpen]);

	const pushRubyDelta = (amount: number, sign: "+" | "-") => {
		const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		setRubyDeltas((prev) => [...prev, { id, amount, sign }]);
		window.setTimeout(() => {
			setRubyDeltas((prev) => prev.filter((d) => d.id !== id));
		}, RUBY_DELTA_LIFETIME_MS);
	};

	const toggle = (id: string) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const handleBuy = async (productId: VendorProductId) => {
		const product = VENDOR_PRODUCTS[productId];
		pushRubyDelta(product.priceRubys, "-");
		try {
			await onBuy(productId);
		} catch (err) {
			// Reverse the optimistic delta so the visual matches the reverted balance.
			pushRubyDelta(product.priceRubys, "+");
			toast.error(err instanceof Error ? err.message : m.vendor_buy_failed());
		}
	};

	// Memoize the selection summary so toggling unrelated state (e.g., the
	// `now` ticker on the seconds-remaining counter elsewhere in the world
	// view) doesn't re-walk the inventory + recompute every sell price.
	const { selectedItems, selectedTotal } = useMemo(() => {
		const items = inventoryItems.filter((it) =>
			selected.has(it._id.toString()),
		);
		const total = items.reduce(
			(sum, it) => sum + computeSellPrice(it.data),
			0,
		);
		return { selectedItems: items, selectedTotal: total };
	}, [inventoryItems, selected]);

	const handleSellSelected = async () => {
		if (selectedItems.length === 0) return;
		const total = selectedTotal;
		const itemIds = selectedItems.map((it) => it._id);
		const previousSelection = new Set(selected);
		pushRubyDelta(total, "+");
		setSelected(new Set());
		try {
			await onSellMany(itemIds);
		} catch (err) {
			// Reverse the optimistic delta + restore the selection so the user can retry.
			pushRubyDelta(total, "-");
			setSelected(previousSelection);
			toast.error(err instanceof Error ? err.message : m.vendor_sell_failed());
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={m.vendor_title()}
			className="max-w-4xl"
		>
			<div className="space-y-5">
				{/* Header row: centered tab strip with ruby balance pinned right.
				 * 3-col grid keeps the tabs visually centered in the modal width
				 * regardless of how wide the balance grows. */}
				<div className="grid grid-cols-3 items-center">
					<div />
					<div className="flex justify-center gap-6 border-white/15 border-b">
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
					<div className="display-title relative flex items-center justify-end gap-2 px-1 text-xl uppercase tracking-[0.15em] text-yellow-300 tabular-nums">
						<Gem className="h-5 w-5 text-rose-400" strokeWidth={2} />
						{rubys}
						{/* Floating deltas — pinned just above the balance, animate up
						 * + fade. Stack vertically if multiple fire close together. */}
						<div className="pointer-events-none absolute right-0 bottom-full mb-1 flex flex-col items-end">
							<AnimatePresence>
								{rubyDeltas.map((d) => (
									<motion.div
										key={d.id}
										initial={{ opacity: 0, y: 8 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -16 }}
										transition={{ duration: 0.4, ease: "easeOut" }}
										className={`display-title flex items-center gap-1 px-1 font-bold text-base tabular-nums tracking-wider ${
											d.sign === "+"
												? "text-emerald-300"
												: "text-red-400"
										}`}
										style={{
											textShadow: "0 2px 4px rgba(0,0,0,0.9)",
										}}
									>
										{d.sign}
										{d.amount}
										<Gem
											className="h-3.5 w-3.5 text-rose-400"
											strokeWidth={2}
										/>
									</motion.div>
								))}
							</AnimatePresence>
						</div>
					</div>
				</div>

				{/* Tab body — fixed min height so switching tabs doesn't make the
				 * modal jump around vertically. */}
				<div className="flex min-h-[460px] flex-col">
					{tab === "buy" ? (
						<BuyTab
							rubys={rubys}
							potions={potions}
							teleportStones={teleportStones}
							windCrystals={windCrystals}
							onBuy={handleBuy}
						/>
					) : (
						<SellTab
							inventoryItems={inventoryItems}
							selected={selected}
							setSelected={setSelected}
							toggle={toggle}
							selectedCount={selectedItems.length}
							selectedTotal={selectedTotal}
							onSell={handleSellSelected}
						/>
					)}
				</div>
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
			className={`display-title relative px-2 pb-2 text-base uppercase tracking-[0.2em] transition ${
				active
					? "text-white"
					: "text-white/40 hover:text-white/70"
			}`}
		>
			{children}
			{active && (
				<span className="-bottom-px absolute right-0 left-0 h-[2px] bg-yellow-300" />
			)}
		</button>
	);
}

function BuyTab({
	rubys,
	potions,
	teleportStones,
	windCrystals,
	onBuy,
}: {
	rubys: number;
	potions: number;
	teleportStones: number;
	windCrystals: number;
	onBuy: (productId: VendorProductId) => Promise<void>;
}) {
	const products = Object.values(VENDOR_PRODUCTS);
	// Map a product's counterField to the corresponding live count from props.
	// Lets `isAtCap` walk the same metadata the server uses, without a switch.
	const counts: Record<string, number> = {
		potions,
		teleportStones,
		windCrystals,
	};
	const isAtCap = (p: (typeof products)[number]): boolean =>
		p.cap !== undefined && (counts[p.counterField] ?? 0) >= p.cap;
	return (
		<div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
			{products.map((p) => {
				const atCap = isAtCap(p);
				const canAfford = rubys >= p.priceRubys;
				const disabled = !canAfford || atCap;
				const buttonLabel = atCap
					? m.vendor_buy_at_cap()
					: m.vendor_buy_action();
				return (
					<div
						key={p.id}
						className="flex flex-col items-center gap-3 rounded-md border border-white/20 bg-black p-4"
					>
						<div className="flex h-16 w-16 items-center justify-center text-5xl">
							{p.emoji}
						</div>
						<div className="display-title text-center text-sm uppercase tracking-[0.15em] text-white">
							{productLabel(p.id)}
						</div>
						<div className="display-title flex items-center gap-1 text-base tabular-nums tracking-wider text-yellow-300">
							<Gem className="h-4 w-4 text-rose-400" strokeWidth={2} />
							{p.priceRubys}
						</div>
						<Button
							type="button"
							variant="starkMuted"
							size="lg"
							onClick={() => onBuy(p.id)}
							disabled={disabled}
							className="w-full text-base uppercase tracking-wider"
						>
							{buttonLabel}
						</Button>
					</div>
				);
			})}
		</div>
	);
}

function SellTab({
	inventoryItems,
	selected,
	setSelected,
	toggle,
	selectedCount,
	selectedTotal,
	onSell,
}: {
	inventoryItems: Doc<"items">[];
	selected: Set<string>;
	setSelected: (next: Set<string>) => void;
	toggle: (id: string) => void;
	selectedCount: number;
	selectedTotal: number;
	onSell: () => Promise<void>;
}) {
	if (inventoryItems.length === 0) {
		return (
			<p className="flex-1 py-12 text-center text-sm text-white/40">
				{m.vendor_sell_empty()}
			</p>
		);
	}

	const allSelected =
		inventoryItems.length > 0 && selectedCount === inventoryItems.length;
	const toggleAll = () => {
		if (allSelected) {
			setSelected(new Set());
		} else {
			setSelected(new Set(inventoryItems.map((it) => it._id.toString())));
		}
	};

	return (
		<div className="flex flex-1 flex-col gap-4">
			<div className="flex justify-end">
				<button
					type="button"
					onClick={toggleAll}
					className="display-title px-2 py-1 text-sm uppercase tracking-[0.2em] text-white/60 transition hover:text-white"
				>
					{allSelected
						? m.vendor_sell_deselect_all()
						: m.vendor_sell_select_all()}
				</button>
			</div>
			<div className="fancy-scroll flex max-h-[50vh] min-h-[20vh] flex-1 flex-wrap content-start gap-3 overflow-y-auto pr-3">
				{inventoryItems.map((item) => {
					const isSelected = selected.has(item._id.toString());
					return (
						<ItemCard
							key={item._id}
							item={item.data}
							size={ITEM_SLOT_SIZE}
							selected={isSelected}
							onClick={() => toggle(item._id.toString())}
						/>
					);
				})}
			</div>
			<div className="flex items-center justify-between border-t border-white/15 pt-3">
				<div className="display-title text-sm uppercase tracking-wider text-white/70">
					{selectedCount > 0 ? (
						<span className="flex items-center gap-2">
							<span>{m.vendor_sell_selected({ count: selectedCount })}</span>
							<span className="flex items-center gap-1 text-yellow-300 tabular-nums">
								<Gem className="h-3.5 w-3.5 text-rose-400" strokeWidth={2} />
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
					disabled={selectedCount === 0}
					className="px-8 text-base uppercase tracking-wider"
				>
					{m.vendor_sell_action()}
				</Button>
			</div>
		</div>
	);
}

// Localised display label per product. Emoji lives on the product data
// itself (see src/game/vendor/products.ts); only the label needs i18n
// routing since it must vary per locale.
function productLabel(id: VendorProductId): string {
	switch (id) {
		case "potion":
			return m.vendor_product_potion();
		case "teleport_stone":
			return m.vendor_product_teleport_stone();
		case "wind_crystal":
			return m.vendor_product_wind_crystal();
		default:
			return id;
	}
}
