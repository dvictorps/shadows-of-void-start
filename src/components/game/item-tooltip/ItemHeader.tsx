import { RARITY_COLORS, RarityHeader } from "#/components/game/rarity-card";
import { isTwoHanded } from "#/game/items/equipment";
import {
	translateItemName,
	translateTemplateName,
} from "#/game/items/item-name";
import type { GeneratedItem, ItemRarity } from "#/game/items/types";
import { m } from "#/paraglide/messages";

const HAS_GENERATED_NAME = new Set<ItemRarity>(["rare", "legendary", "epic"]);
const HAS_ORNAMENTS = new Set<ItemRarity>(["rare", "legendary", "epic"]);
const OFFHAND_TYPES = new Set(["offhand", "tome", "quiver"]);

const SUBTITLE =
	"px-4 py-0.5 text-center text-[10px] uppercase tracking-wider text-white/40";

export default function ItemHeader({ item }: { item: GeneratedItem }) {
	const nameColor = RARITY_COLORS[item.rarity];
	const showGeneratedName = HAS_GENERATED_NAME.has(item.rarity);
	return (
		<>
			{HAS_ORNAMENTS.has(item.rarity) && <CornerOrnaments color={nameColor} />}

			<RarityHeader rarity={item.rarity}>
				{showGeneratedName && (
					<div className="text-lg" style={{ color: nameColor }}>
						{translateItemName(item)}
					</div>
				)}
				<div
					className={showGeneratedName ? "text-sm" : "text-lg"}
					style={{ color: nameColor }}
				>
					{showGeneratedName
						? translateTemplateName(item)
						: translateItemName(item)}
				</div>
			</RarityHeader>

			{item.equipmentType === "weapon" && (
				<div className={SUBTITLE}>
					{isTwoHanded(item) ? m.tooltip_two_handed() : m.tooltip_one_handed()}
				</div>
			)}
			{OFFHAND_TYPES.has(item.equipmentType) && (
				<div className={SUBTITLE}>{m.tooltip_offhand()}</div>
			)}
		</>
	);
}

function CornerOrnaments({ color }: { color: string }) {
	const style = { borderColor: color };
	const base = "absolute h-2 w-2 pointer-events-none";
	return (
		<>
			<div
				className={`${base} top-0 left-0 border-t-2 border-l-2`}
				style={style}
			/>
			<div
				className={`${base} top-0 right-0 border-t-2 border-r-2`}
				style={style}
			/>
			<div
				className={`${base} bottom-0 left-0 border-b-2 border-l-2`}
				style={style}
			/>
			<div
				className={`${base} bottom-0 right-0 border-b-2 border-r-2`}
				style={style}
			/>
		</>
	);
}
