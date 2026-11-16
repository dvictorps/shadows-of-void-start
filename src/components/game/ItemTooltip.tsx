// The item tooltip: header, stat blocks, mods, requirements and item level,
// in a rarity-framed card. This file composes `item-tooltip/*`; the stat
// lines are data built in `item-tooltip/stat-rows.ts`. Pinned by
// ItemTooltip.test.tsx.
import { RarityCard, TooltipSeparator } from "#/components/ui/rarity-card";
import type { GeneratedItem, ItemRarity } from "#/game/items/types";
import { m } from "#/paraglide/messages";

import { DIM_COLOR } from "./item-tooltip/colors";
import ItemHeader from "./item-tooltip/ItemHeader";
import ModLines from "./item-tooltip/ModLines";
import Requirements from "./item-tooltip/Requirements";
import {
	attackWeaponRows,
	defenseRows,
	spellWeaponRows,
} from "./item-tooltip/stat-rows";
import StatBlock from "./item-tooltip/StatBlock";

const HAS_GLOW = new Set<ItemRarity>(["legendary", "epic"]);

export default function ItemTooltip({
	item,
	brokenReasons,
}: {
	item: GeneratedItem;
	brokenReasons?: string[];
}) {
	return (
		<RarityCard
			rarity={item.rarity}
			showGlow={HAS_GLOW.has(item.rarity)}
			className="min-w-[260px] max-w-[380px]"
		>
			{/* Broken-state warning band — overrides the rarity accent above it. */}
			{brokenReasons && brokenReasons.length > 0 && (
				<div className="bg-red-900/40 px-4 py-1 font-bold text-red-300 text-xs uppercase tracking-wider">
					{brokenReasons.map((r) => (
						<div key={r}>{r}</div>
					))}
				</div>
			)}

			<ItemHeader item={item} />
			<TooltipSeparator />

			<StatBlock rows={attackWeaponRows(item)} />
			<StatBlock rows={spellWeaponRows(item)} />
			<StatBlock rows={defenseRows(item)} />

			<ModLines item={item} />
			<Requirements item={item} />

			<TooltipSeparator />
			<div
				className="px-4 py-1 pb-2 text-xs uppercase tracking-wider"
				style={{ color: DIM_COLOR }}
			>
				{m.tooltip_item_level()}:{" "}
				<span className="text-white">{item.itemLevel}</span>
			</div>
		</RarityCard>
	);
}
