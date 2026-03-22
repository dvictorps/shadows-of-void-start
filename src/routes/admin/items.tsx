import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { Button } from "#/components/ui/button"
import ItemTooltip from "#/components/game/ItemTooltip"
import { generateItem } from "#/game/items/generator"
import type { GeneratedItem, ItemRarity } from "#/game/items/types"

export const Route = createFileRoute("/admin/items")({
	component: ItemGeneratorPage,
})

const RARITIES: { value: ItemRarity; label: string }[] = [
	{ value: "normal", label: "Normal" },
	{ value: "magic", label: "Magic" },
	{ value: "rare", label: "Rare" },
	{ value: "legendary", label: "Legendary" },
	{ value: "epic", label: "Epic" },
]

function ItemGeneratorPage() {
	const [items, setItems] = useState<GeneratedItem[]>([])
	const [rarity, setRarity] = useState<ItemRarity>("rare")
	const [itemLevel, setItemLevel] = useState(50)

	const handleGenerate = () => {
		const item = generateItem({ rarity, itemLevel })
		setItems((prev) => [item, ...prev])
	}

	const handleClear = () => setItems([])

	return (
		<div>
			<h1 className="mb-6 text-xl font-bold">Item Generator</h1>

			<div className="mb-6 flex flex-wrap items-end gap-4">
				<div>
					<label className="mb-1 block text-xs font-medium text-neutral-500">
						Rarity
					</label>
					<div className="flex gap-1">
						{RARITIES.map((r) => (
							<button
								key={r.value}
								type="button"
								onClick={() => setRarity(r.value)}
								className={`rounded px-3 py-1.5 text-xs font-medium transition ${
									rarity === r.value
										? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
										: "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
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
						className="mb-1 block text-xs font-medium text-neutral-500"
					>
						Item Level: {itemLevel}
					</label>
					<input
						id="ilvl"
						type="range"
						min={1}
						max={100}
						value={itemLevel}
						onChange={(e) => setItemLevel(Number(e.target.value))}
						className="w-48"
					/>
				</div>

				<Button onClick={handleGenerate}>Generate Item</Button>

				{items.length > 0 && (
					<Button variant="outline" onClick={handleClear}>
						Clear
					</Button>
				)}
			</div>

			{items.length === 0 && (
				<p className="text-sm text-neutral-400">
					Click "Generate Item" to create an item.
				</p>
			)}

			<div className="flex flex-wrap gap-4">
				{items.map((item) => (
					<ItemTooltip key={item.id} item={item} />
				))}
			</div>
		</div>
	)
}
