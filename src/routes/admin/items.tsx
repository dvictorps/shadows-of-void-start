import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import ItemTooltip from "#/components/game/ItemTooltip";
import { Button } from "#/components/ui/button";
import { Label } from "#/components/ui/label";
import { generateItem } from "#/game/items/generator";
import type { GeneratedItem, ItemRarity } from "#/game/items/types";

export const Route = createFileRoute("/admin/items")({
	component: ItemGeneratorPage,
});

const MAX_DISPLAYED_ITEMS = 50;

const RARITIES: { value: ItemRarity; label: string }[] = [
	{ value: "normal", label: "Normal" },
	{ value: "magic", label: "Magic" },
	{ value: "rare", label: "Rare" },
	{ value: "legendary", label: "Legendary" },
	{ value: "epic", label: "Epic" },
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
				Item Generator / Generator de Itens
			</h1>

			<div className="flex flex-wrap items-end gap-5 border-b border-white/15 pb-5">
				<div>
					<span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/60">
						Rarity
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
								{r.label}
							</Button>
						))}
					</div>
				</div>

				<div>
					<Label htmlFor="ilvl" variant="caps" className="mb-1.5 block">
						Item Level: <span className="text-white">{itemLevel}</span>
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
					Generate
				</Button>

				{items.length > 0 && (
					<Button type="button" variant="starkMuted" caps onClick={handleClear}>
						Clear
					</Button>
				)}
			</div>

			{items.length === 0 ? (
				<p className="text-sm uppercase tracking-wider text-white/40">
					Click &quot;Generate&quot; to create an item.
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
