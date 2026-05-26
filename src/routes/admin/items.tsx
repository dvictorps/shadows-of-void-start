import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import ItemTooltip from "#/components/game/ItemTooltip";
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
			<h1 className="display-title text-2xl uppercase tracking-[0.15em] text-white">
				Item Generator / Generator de Itens
			</h1>

			<div className="flex flex-wrap items-end gap-5 border-b border-white/15 pb-5">
				<div>
					<span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/60">
						Rarity
					</span>
					<div className="flex flex-wrap gap-1.5">
						{RARITIES.map((r) => (
							<button
								key={r.value}
								type="button"
								onClick={() => setRarity(r.value)}
								className={`border px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors ${
									rarity === r.value
										? "border-white bg-white text-black"
										: "border-white/40 bg-black text-white hover:bg-white/10"
								}`}
							>
								{r.label}
							</button>
						))}
					</div>
				</div>

				<div>
					<label
						htmlFor="ilvl"
						className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/60"
					>
						Item Level: <span className="text-white">{itemLevel}</span>
					</label>
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

				<button
					type="button"
					onClick={handleGenerate}
					className="border border-white bg-black px-5 py-2 text-sm font-medium uppercase tracking-wider text-white transition-colors hover:bg-white/10"
				>
					Generate
				</button>

				{items.length > 0 && (
					<button
						type="button"
						onClick={handleClear}
						className="border border-white/40 bg-black px-5 py-2 text-sm font-medium uppercase tracking-wider text-white/70 transition-colors hover:bg-white/10 hover:text-white"
					>
						Clear
					</button>
				)}
			</div>

			{items.length === 0 ? (
				<p className="text-sm uppercase tracking-wider text-white/40">
					Click "Generate" to create an item.
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
