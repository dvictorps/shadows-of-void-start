import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import ItemCard from "#/components/game/ItemCard";
import Modal from "#/components/Modal";
import { Button } from "#/components/ui/button";
import Tooltip from "#/components/ui/tooltip";
import { computeSellPrice } from "#/game/items/sell-price";
import { VENDOR_PRODUCTS, type VendorProductId } from "#/game/vendor/products";
import { useInFlight } from "#/hooks/useInFlight";
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
	inventoryItems: Doc<"items">[];
	onBuy: (productId: VendorProductId, quantity: number) => Promise<void>;
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
	inventoryItems,
	onBuy,
	onSellMany,
}: Props) {
	const [tab, setTab] = useState<Tab>("buy");
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [rubyDeltas, setRubyDeltas] = useState<RubyDelta[]>([]);
	// Per-product in-flight tracking so spamming buy on the same product
	// only fires one request at a time. The button-disabled state is the
	// actual guard; the early-return in handleBuy is belt-and-suspenders
	// for the render-cycle window where a click arrives before React
	// commits the disabled state. Real abuse hardening (e.g. someone
	// hitting the Convex endpoint directly) needs server-side rate
	// limiting — deferred, see docs/security/threat-model.md.
	const [pendingBuys, setPendingBuys] = useState<Set<VendorProductId>>(
		new Set(),
	);
	const [isSelling, runSell] = useInFlight(isOpen);

	useEffect(() => {
		if (!isOpen) return;
		setSelected(new Set());
		setRubyDeltas([]);
		setPendingBuys(new Set());
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

	const handleBuy = async (productId: VendorProductId, quantity: number) => {
		if (pendingBuys.has(productId)) return;
		const product = VENDOR_PRODUCTS[productId];
		const totalCost = product.priceRubys * quantity;
		setPendingBuys((prev) => {
			const next = new Set(prev);
			next.add(productId);
			return next;
		});
		pushRubyDelta(totalCost, "-");
		try {
			await onBuy(productId, quantity);
		} catch (err) {
			// Reverse the optimistic delta so the visual matches the reverted balance.
			pushRubyDelta(totalCost, "+");
			toast.error(err instanceof Error ? err.message : m.vendor_buy_failed());
		} finally {
			setPendingBuys((prev) => {
				const next = new Set(prev);
				next.delete(productId);
				return next;
			});
		}
	};

	// Memoize the selection summary so toggling unrelated state (e.g., the
	// `now` ticker on the seconds-remaining counter elsewhere in the world
	// view) doesn't re-walk the inventory + recompute every sell price.
	const { selectedItems, selectedTotal } = useMemo(() => {
		const items = inventoryItems.filter((it) =>
			selected.has(it._id.toString()),
		);
		const total = items.reduce((sum, it) => sum + computeSellPrice(it.data), 0);
		return { selectedItems: items, selectedTotal: total };
	}, [inventoryItems, selected]);

	const handleSellSelected = async () => {
		if (selectedItems.length === 0) return;
		const total = selectedTotal;
		const itemIds = selectedItems.map((it) => it._id);
		const previousSelection = new Set(selected);
		await runSell(async () => {
			pushRubyDelta(total, "+");
			setSelected(new Set());
			try {
				await onSellMany(itemIds);
			} catch (err) {
				// Reverse the optimistic delta + restore the selection so the user can retry.
				pushRubyDelta(total, "-");
				setSelected(previousSelection);
				toast.error(
					err instanceof Error ? err.message : m.vendor_sell_failed(),
				);
			}
		});
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
						<TabButton active={tab === "sell"} onClick={() => setTab("sell")}>
							{m.vendor_tab_sell()}
						</TabButton>
					</div>
					<Tooltip content="Rubis — moeda do jogo">
						<div className="display-title relative flex items-center justify-end gap-2 px-1 text-xl uppercase tracking-[0.15em] text-yellow-300 tabular-nums">
							<img
								src="/assets/sprites/ui/moedaRubi.png"
								alt=""
								draggable={false}
								className="pointer-events-none h-6 w-6 select-none object-contain"
							/>
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
												d.sign === "+" ? "text-emerald-300" : "text-red-400"
											}`}
											style={{
												textShadow: "0 2px 4px rgba(0,0,0,0.9)",
											}}
										>
											{d.sign}
											{d.amount}
											<img
												src="/assets/sprites/ui/moedaRubi.png"
												alt=""
												draggable={false}
												className="pointer-events-none h-4 w-4 select-none object-contain"
											/>
										</motion.div>
									))}
								</AnimatePresence>
							</div>
						</div>
					</Tooltip>
				</div>

				{/* Tab body — fixed min height so switching tabs doesn't make the
				 * modal jump around vertically. */}
				<div className="flex min-h-[460px] flex-col">
					{tab === "buy" ? (
						<BuyTab
							rubys={rubys}
							potions={potions}
							teleportStones={teleportStones}
							onBuy={handleBuy}
							pendingBuys={pendingBuys}
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
							isSelling={isSelling}
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
				active ? "text-white" : "text-white/40 hover:text-white/70"
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
	onBuy,
	pendingBuys,
}: {
	rubys: number;
	potions: number;
	teleportStones: number;
	onBuy: (productId: VendorProductId, quantity: number) => Promise<void>;
	pendingBuys: Set<VendorProductId>;
}) {
	const products = Object.values(VENDOR_PRODUCTS);
	// Counter-field lookup so cap math walks the same field the server keys on.
	const counts: Record<string, number> = {
		potions,
		teleportStones,
	};
	return (
		<div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
			{products.map((p) => (
				<BuyCard
					key={p.id}
					product={p}
					rubys={rubys}
					currentCount={counts[p.counterField] ?? 0}
					pending={pendingBuys.has(p.id)}
					onBuy={onBuy}
				/>
			))}
		</div>
	);
}

function BuyCard({
	product,
	rubys,
	currentCount,
	pending,
	onBuy,
}: {
	product: (typeof VENDOR_PRODUCTS)[VendorProductId];
	rubys: number;
	currentCount: number;
	pending: boolean;
	onBuy: (productId: VendorProductId, quantity: number) => Promise<void>;
}) {
	// Hard ceiling on the stepper so users can't accidentally queue a 4-digit
	// batch with one click-and-hold. Caps the visual qty too; affordability and
	// product cap will still clamp tighter when applicable.
	const STEPPER_MAX = 99;
	const capRemaining =
		product.cap !== undefined ? Math.max(0, product.cap - currentCount) : STEPPER_MAX;
	const maxAfford =
		product.priceRubys > 0 ? Math.floor(rubys / product.priceRubys) : STEPPER_MAX;
	const maxQty = Math.min(STEPPER_MAX, capRemaining, maxAfford);
	const atCap = capRemaining === 0;
	const [qty, setQty] = useState(1);
	// Clamp whenever the live caps move below the user's chosen qty (e.g. they
	// type a number, then a recordKill arrives and shrinks affordability).
	useEffect(() => {
		if (maxQty <= 0) {
			if (qty !== 1) setQty(1);
			return;
		}
		if (qty > maxQty) setQty(maxQty);
		if (qty < 1) setQty(1);
	}, [qty, maxQty]);
	const totalCost = product.priceRubys * qty;
	const disabled = pending || atCap || maxQty < qty || rubys < totalCost;
	const buttonLabel = atCap
		? m.vendor_buy_at_cap()
		: qty > 1
			? `${m.vendor_buy_action()} x${qty}`
			: m.vendor_buy_action();
	const decDisabled = qty <= 1 || pending;
	const incDisabled = qty >= maxQty || pending;
	return (
		<div className="flex flex-col items-center gap-3 rounded-md border border-white/20 bg-black p-4">
			<div className="flex h-16 w-16 items-center justify-center text-5xl">
				{product.icon ? (
					<img
						src={product.icon}
						alt=""
						draggable={false}
						className="pointer-events-none h-14 w-14 select-none object-contain"
					/>
				) : (
					product.emoji
				)}
			</div>
			<div className="display-title text-center text-sm uppercase tracking-[0.15em] text-white">
				{productLabel(product.id)}
			</div>
			<div className="display-title flex items-center gap-1 text-base tabular-nums tracking-wider text-yellow-300">
				<img
					src="/assets/sprites/ui/moedaRubi.png"
					alt=""
					draggable={false}
					className="pointer-events-none h-5 w-5 select-none object-contain"
				/>
				{totalCost}
			</div>
			<div className="flex w-full items-center justify-center gap-2">
				<StepperButton
					onClick={() => setQty((q) => Math.max(1, q - 1))}
					disabled={decDisabled}
					ariaLabel={m.vendor_buy_decrement()}
				>
					−
				</StepperButton>
				<span className="display-title min-w-[2.5rem] text-center text-base tabular-nums tracking-wider text-white">
					{qty}
				</span>
				<StepperButton
					onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
					disabled={incDisabled}
					ariaLabel={m.vendor_buy_increment()}
				>
					+
				</StepperButton>
			</div>
			<Button
				type="button"
				variant="starkMuted"
				size="lg"
				onClick={() => onBuy(product.id, qty)}
				disabled={disabled}
				className="w-full text-base uppercase tracking-wider"
			>
				{buttonLabel}
			</Button>
		</div>
	);
}

function StepperButton({
	onClick,
	disabled,
	ariaLabel,
	children,
}: {
	onClick: () => void;
	disabled: boolean;
	ariaLabel: string;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-label={ariaLabel}
			className="display-title flex h-8 w-8 items-center justify-center rounded border border-white/25 bg-black/40 text-lg text-white transition hover:border-white/60 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/25 disabled:hover:bg-black/40"
		>
			{children}
		</button>
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
	isSelling,
}: {
	inventoryItems: Doc<"items">[];
	selected: Set<string>;
	setSelected: (next: Set<string>) => void;
	toggle: (id: string) => void;
	selectedCount: number;
	selectedTotal: number;
	onSell: () => Promise<void>;
	isSelling: boolean;
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
								<img
									src="/assets/sprites/ui/moedaRubi.png"
									alt=""
									draggable={false}
									className="pointer-events-none h-4 w-4 select-none object-contain"
								/>
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

// Localised display label per product. Emoji lives on the product data
// itself (see src/game/vendor/products.ts); only the label needs i18n
// routing since it must vary per locale.
function productLabel(id: VendorProductId): string {
	switch (id) {
		case "potion":
			return m.vendor_product_potion();
		case "teleport_stone":
			return m.vendor_product_teleport_stone();
		default:
			return id;
	}
}
