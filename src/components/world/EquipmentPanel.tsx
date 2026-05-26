import { useMemo } from "react";
import ItemCard, {
	BROKEN_BORDER,
	BROKEN_GLOW,
	RARITY_BORDER,
	RARITY_GLOW,
} from "#/components/game/ItemCard";
import { describeBrokenReasons } from "#/game/stats/compute";
import type { ComputedCharacterStats, EquippedSlot } from "#/game/stats/types";
import { useCompactViewport } from "#/hooks/useCompactViewport";
import { m } from "#/paraglide/messages";
import InventoryButton from "./InventoryButton";
import RubyCounter from "./RubyCounter";

type Props = {
	equippedBySlot: ReadonlyMap<
		EquippedSlot,
		{ id: string; data: import("#/game/items/types").GeneratedItem }
	>;
	stats: ComputedCharacterStats;
	characterLevel: number;
	rubys: number;
	onOpenInventory?: () => void;
};

type SlotConfig = {
	slot: EquippedSlot;
	area: string;
	label: () => string;
	size: { w: number; h: number };
};

const SLOT_CONFIG: SlotConfig[] = [
	{
		slot: "helmet",
		area: "helmet",
		label: m.slot_label_helmet,
		size: { w: 120, h: 120 },
	},
	{
		slot: "amulet",
		area: "amulet",
		label: m.slot_label_amulet,
		size: { w: 104, h: 104 },
	},
	{
		slot: "weapon",
		area: "weapon",
		label: m.slot_label_weapon,
		size: { w: 120, h: 170 },
	},
	{
		slot: "chestplate",
		area: "body",
		label: m.slot_label_chestplate,
		size: { w: 120, h: 170 },
	},
	{
		slot: "offhand",
		area: "offhand",
		label: m.slot_label_offhand,
		size: { w: 120, h: 170 },
	},
	{
		slot: "ring1",
		area: "ring1",
		label: m.slot_label_ring,
		size: { w: 104, h: 104 },
	},
	{
		slot: "belt",
		area: "belt",
		label: m.slot_label_belt,
		size: { w: 120, h: 50 },
	},
	{
		slot: "ring2",
		area: "ring2",
		label: m.slot_label_ring,
		size: { w: 104, h: 104 },
	},
	{
		slot: "gloves",
		area: "gloves",
		label: m.slot_label_gloves,
		size: { w: 120, h: 120 },
	},
	{
		slot: "boots",
		area: "boots",
		label: m.slot_label_boots,
		size: { w: 120, h: 120 },
	},
];

const GRID_AREAS = `
	".      helmet amulet"
	"weapon body   offhand"
	"ring1  belt   ring2"
	"gloves .      boots"
`;

const COL_BASE = 120;
const ROW_HEIGHTS = [120, 170, 104, 120];

export default function EquipmentPanel({
	equippedBySlot,
	stats,
	characterLevel,
	rubys,
	onOpenInventory,
}: Props) {
	const compact = useCompactViewport();
	const s = compact ? 0.65 : 1;

	const scaled = useMemo(
		() => ({
			grid: {
				gridTemplateColumns: `repeat(3, ${Math.round(COL_BASE * s)}px)`,
				gridTemplateRows: ROW_HEIGHTS.map(
					(h) => `${Math.round(h * s)}px`,
				).join(" "),
				gridTemplateAreas: GRID_AREAS,
			},
			slots: SLOT_CONFIG.map((cfg) => ({
				w: Math.round(cfg.size.w * s),
				h: Math.round(cfg.size.h * s),
			})),
		}),
		[s],
	);

	const mainHandWeaponType = equippedBySlot.get("weapon")?.data.weaponType;
	return (
		<section
			className={`relative rounded-md border border-white/40 ${compact ? "p-1.5" : "p-3"}`}
		>
			<div className="flex h-full items-center justify-center">
				<div
					className={`grid ${compact ? "gap-1" : "gap-2"}`}
					style={scaled.grid}
				>
					{SLOT_CONFIG.map((cfg, i) => {
						const entry = equippedBySlot.get(cfg.slot);
						const broken = entry ? stats.brokenItemIds.has(entry.id) : false;
						const reasons =
							broken && entry
								? describeBrokenReasons(
										entry.data,
										stats,
										characterLevel,
										mainHandWeaponType,
									)
								: undefined;
						return (
							<EquipmentSlot
								key={cfg.slot}
								cfg={cfg}
								scaledSize={scaled.slots[i]}
								item={entry?.data ?? null}
								broken={broken}
								brokenReasons={reasons}
							/>
						);
					})}
				</div>
			</div>
			<InventoryButton onClick={onOpenInventory} />
			<RubyCounter rubys={rubys} />
		</section>
	);
}

function EquipmentSlot({
	cfg,
	scaledSize,
	item,
	broken,
	brokenReasons,
}: {
	cfg: SlotConfig;
	scaledSize: { w: number; h: number };
	item: import("#/game/items/types").GeneratedItem | null;
	broken: boolean;
	brokenReasons: string[] | undefined;
}) {
	const innerSize = { w: scaledSize.w - 8, h: scaledSize.h - 8 };
	const frameClass = item
		? `border-2 bg-black ${broken ? BROKEN_BORDER : RARITY_BORDER[item.rarity]} ${broken ? BROKEN_GLOW : RARITY_GLOW[item.rarity]}`
		: "border border-white/30 bg-black/40";
	return (
		<div
			data-slot={cfg.slot}
			data-slot-area={cfg.area}
			style={{
				gridArea: cfg.area,
				width: scaledSize.w,
				height: scaledSize.h,
				placeSelf: "center",
			}}
			className={`relative flex items-center justify-center rounded-md ${frameClass}`}
		>
			{item ? (
				<ItemCard
					item={item}
					size={innerSize}
					broken={broken}
					brokenReasons={brokenReasons}
					frameless
				/>
			) : (
				<span className="text-[10px] uppercase tracking-wider text-white/40">
					{cfg.label()}
				</span>
			)}
		</div>
	);
}
