import { useState } from "react";

import RubyIcon from "#/components/game/RubyIcon";
import { Button } from "#/components/ui/button";
import {
	VENDOR_PRODUCTS,
	type VendorCounterField,
	type VendorProduct,
	type VendorProductId,
} from "#/game/vendor/products";
import { m } from "#/paraglide/messages";

import { buyLimits, clampQty } from "./buy-limits";

type OnBuy = (productId: VendorProductId, quantity: number) => Promise<void>;

/** The Buy tab: one card per vendor product. */
export default function BuyTab({
	rubys,
	potions,
	teleportStones,
	pendingBuys,
	onBuy,
}: {
	rubys: number;
	potions: number;
	teleportStones: number;
	pendingBuys: ReadonlySet<VendorProductId>;
	onBuy: OnBuy;
}) {
	// Counter-field lookup so cap math walks the same field the server keys on.
	const counts = {
		potions,
		teleportStones,
	} satisfies Record<VendorCounterField, number>;
	return (
		<div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
			{Object.values(VENDOR_PRODUCTS).map((p) => (
				<BuyCard
					key={p.id}
					product={p}
					rubys={rubys}
					currentCount={counts[p.counterField]}
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
	product: VendorProduct;
	rubys: number;
	currentCount: number;
	pending: boolean;
	onBuy: OnBuy;
}) {
	const { maxQty, atCap } = buyLimits(product, rubys, currentCount);
	const [qty, setQty] = useState(1);
	// Clamp when live affordability/cap shrinks below the user's chosen qty.
	// Adjusted during render (React's "adjust state when a prop changes"
	// pattern); the guard makes the re-render converge in one pass.
	const clampedQty = clampQty(qty, maxQty);
	if (clampedQty !== qty) setQty(clampedQty);
	const totalCost = product.priceRubys * qty;
	const disabled = pending || atCap || maxQty < qty || rubys < totalCost;
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
				<RubyIcon className="h-5 w-5" />
				{totalCost}
			</div>
			<div className="flex w-full items-center justify-center gap-2">
				<StepperButton
					onClick={() => setQty((q) => Math.max(1, q - 1))}
					disabled={qty <= 1 || pending}
					ariaLabel={m.vendor_buy_decrement()}
				>
					−
				</StepperButton>
				<span className="display-title min-w-[2.5rem] text-center text-base tabular-nums tracking-wider text-white">
					{qty}
				</span>
				<StepperButton
					onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
					disabled={qty >= maxQty || pending}
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
				{buyLabel(atCap, qty)}
			</Button>
		</div>
	);
}

function buyLabel(atCap: boolean, qty: number): string {
	if (atCap) return m.vendor_buy_at_cap();
	if (qty > 1) return m.vendor_buy_action_qty({ qty });
	return m.vendor_buy_action();
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
		<Button
			type="button"
			variant="ghost-purple"
			size="inline"
			onClick={onClick}
			disabled={disabled}
			aria-label={ariaLabel}
			// The stepper's own look: rounded, faint border, translucent fill.
			className="display-title h-8 w-8 rounded border border-white/25 bg-black/40 text-lg text-white hover:border-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30"
		>
			{children}
		</Button>
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
	}
}
