import { useMemo, useState } from "react";
import { toast } from "sonner";

import Modal from "#/components/Modal";
import { Button } from "#/components/ui/button";
import { computeSellPrice } from "#/game/items/sell-price";
import { VENDOR_PRODUCTS, type VendorProductId } from "#/game/vendor/products";
import { useExpiringList } from "#/hooks/useExpiringList";
import { useInFlight } from "#/hooks/useInFlight";
import { useOpenedEdge } from "#/hooks/useOpenedEdge";
import type { ItemRow } from "#/lib/api-types";
import { serverErrorMessage } from "#/lib/server-error-message";
import { m } from "#/paraglide/messages";

import { toggleId } from "./item-selection";
import BuyTab from "./vendor-modal/BuyTab";
import RubyBalance, { type RubyDelta } from "./vendor-modal/RubyBalance";
import SellTab from "./vendor-modal/SellTab";

type Tab = "buy" | "sell";

type Props = {
	isOpen: boolean;
	onClose: () => void;
	rubys: number;
	potions: number;
	teleportStones: number;
	inventoryItems: ItemRow[];
	onBuy: (productId: VendorProductId, quantity: number) => Promise<void>;
	onSellMany: (itemIds: number[]) => Promise<void>;
};

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
	const [selected, setSelected] = useState(() => new Set<number>());
	const {
		items: rubyDeltas,
		push: pushRubyDelta,
		clear: clearRubyDeltas,
	} = useExpiringList<Omit<RubyDelta, "id">>(RUBY_DELTA_LIFETIME_MS);
	const [pendingBuys, setPendingBuys] = useState(
		() => new Set<VendorProductId>(),
	);
	const [isSelling, runSell] = useInFlight(isOpen);

	const justOpened = useOpenedEdge(isOpen);
	if (justOpened) {
		setSelected(new Set());
		clearRubyDeltas();
		setPendingBuys(new Set());
	}

	const handleBuy = async (productId: VendorProductId, quantity: number) => {
		if (pendingBuys.has(productId)) return;
		const totalCost = VENDOR_PRODUCTS[productId].priceRubys * quantity;
		setPendingBuys((prev) => new Set([...prev, productId]));
		pushRubyDelta({ amount: totalCost, sign: "-" });
		try {
			await onBuy(productId, quantity);
		} catch (err) {
			pushRubyDelta({ amount: totalCost, sign: "+" });
			toast.error(serverErrorMessage(err, m.vendor_buy_failed()));
		} finally {
			setPendingBuys((prev) => {
				const next = new Set(prev);
				next.delete(productId);
				return next;
			});
		}
	};

	const { selectedItems, selectedTotal } = useMemo(() => {
		const items = inventoryItems.filter((it) => selected.has(it.id));
		const total = items.reduce((sum, it) => sum + computeSellPrice(it.data), 0);
		return { selectedItems: items, selectedTotal: total };
	}, [inventoryItems, selected]);

	const handleToggleAll = () => {
		setSelected(
			selectedItems.length === inventoryItems.length
				? new Set()
				: new Set(inventoryItems.map((it) => it.id)),
		);
	};

	const handleSellSelected = async () => {
		if (selectedItems.length === 0) return;
		const total = selectedTotal;
		const itemIds = selectedItems.map((it) => it.id);
		const previousSelection = new Set(selected);
		await runSell(async () => {
			pushRubyDelta({ amount: total, sign: "+" });
			setSelected(new Set());
			try {
				await onSellMany(itemIds);
			} catch (err) {
				pushRubyDelta({ amount: total, sign: "-" });
				setSelected(previousSelection);
				toast.error(serverErrorMessage(err, m.vendor_sell_failed()));
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
					<RubyBalance rubys={rubys} deltas={rubyDeltas} />
				</div>

				<div className="flex min-h-[460px] flex-col">
					{tab === "buy" ? (
						<BuyTab
							rubys={rubys}
							potions={potions}
							teleportStones={teleportStones}
							pendingBuys={pendingBuys}
							onBuy={handleBuy}
						/>
					) : (
						<SellTab
							inventoryItems={inventoryItems}
							selected={selected}
							selectedCount={selectedItems.length}
							selectedTotal={selectedTotal}
							isSelling={isSelling}
							onToggle={(id) => setSelected((prev) => toggleId(prev, id))}
							onToggleAll={handleToggleAll}
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
		<Button
			type="button"
			variant="starkText"
			size="inline"
			aria-pressed={active}
			onClick={onClick}
			className={`display-title relative rounded-none px-2 pb-2 text-base font-normal uppercase tracking-[0.2em] ${
				active ? "text-white" : "text-white/40 hover:text-white/70"
			}`}
		>
			{children}
			{active && (
				<span className="-bottom-px absolute right-0 left-0 h-[2px] bg-yellow-300" />
			)}
		</Button>
	);
}
