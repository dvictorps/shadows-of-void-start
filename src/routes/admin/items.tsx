import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import ItemTooltip from "#/components/game/ItemTooltip";
import { Button } from "#/components/ui/button";
import { Label } from "#/components/ui/label";
import { generateItem } from "#/game/items/generator";
import type { GeneratedItem, ItemRarity } from "#/game/items/types";
import { m } from "#/paraglide/messages";

export const Route = createFileRoute("/admin/items")({
	component: ItemGeneratorPage,
});

const MAX_DISPLAYED_ITEMS = 50;

const RARITIES: { value: ItemRarity; label: () => string }[] = [
	{ value: "normal", label: m.rarity_normal },
	{ value: "magic", label: m.rarity_magic },
	{ value: "rare", label: m.rarity_rare },
	{ value: "legendary", label: m.rarity_legendary },
	{ value: "epic", label: m.rarity_epic },
];

function ItemGeneratorPage() {
	const [items, setItems] = useState<GeneratedItem[]>([]);
	const [rarity, setRarity] = useState<ItemRarity>("rare");
	const [itemLevel, setItemLevel] = useState(50);

	const handleGenerate = () => {
		const item = generateItem({ rarity, itemLevel });
		setItems((prev) => [item, ...prev].slice(0, MAX_DISPLAYED_ITEMS));
	};

	const handleClear = () => setItems([]);

	return (
		<div className="flex h-full flex-col gap-5">
			<h1 className="display-title text-2xl uppercase tracking-title text-white">
				{m.admin_items_title()}
			</h1>

			<div className="flex flex-wrap items-end gap-5 border-b border-white/15 pb-5">
				<div>
					<span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/60">
						{m.admin_items_rarity()}
					</span>
					<div className="flex flex-wrap gap-1.5">
						{RARITIES.map((r) => (
							<Button
								key={r.value}
								type="button"
								variant="toggle"
								size="tab-sm"
								caps
								aria-pressed={rarity === r.value}
								onClick={() => setRarity(r.value)}
							>
								{r.label()}
							</Button>
						))}
					</div>
				</div>

				<div>
					<Label htmlFor="ilvl" variant="caps" className="mb-1.5 block">
						{m.admin_items_item_level()}{" "}
						<span className="text-white">{itemLevel}</span>
					</Label>
					<input
						id="ilvl"
						type="range"
						min={1}
						max={100}
						value={itemLevel}
						onChange={(e) => setItemLevel(Number(e.target.value))}
						className="w-48 accent-white"
					/>
				</div>

				<Button type="button" variant="stark" caps onClick={handleGenerate}>
					{m.admin_items_generate()}
				</Button>

				{items.length > 0 && (
					<Button type="button" variant="starkMuted" caps onClick={handleClear}>
						{m.admin_items_clear()}
					</Button>
				)}
			</div>

			{items.length === 0 ? (
				<p className="text-sm uppercase tracking-wider text-white/40">
					{m.admin_items_empty()}
				</p>
			) : (
				<div className="flex-1 overflow-y-auto pr-2">
					<div className="flex flex-wrap gap-4">
						{items.map((item) => (
							<ItemTooltip key={item.id} item={item} />
						))}
					</div>
				</div>
			)}
		</div>
	);
}
