import ItemCard, {
	BROKEN_BORDER,
	BROKEN_GLOW,
	RARITY_BORDER,
	RARITY_GLOW,
} from "#/components/game/ItemCard";
import { describeBrokenReasons } from "#/game/stats/compute";
import type { ComputedCharacterStats, EquippedSlot } from "#/game/stats/types";
import { useFitScale } from "#/hooks/useFitScale";
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

const GRID_ROWS = [120, 170, 104, 120];
const GRID_GAP = 8;
const GRID_HEIGHT =
	GRID_ROWS.reduce((sum, row) => sum + row, 0) +
	GRID_GAP * (GRID_ROWS.length - 1);

const GRID_STYLE = {
	gridTemplateColumns: "repeat(3, 120px)",
	gridTemplateRows: GRID_ROWS.map((row) => `${row}px`).join(" "),
	gridTemplateAreas: GRID_AREAS,
	gap: GRID_GAP,
};

export default function EquipmentPanel({
	equippedBySlot,
	stats,
	characterLevel,
	rubys,
	onOpenInventory,
}: Props) {
	const mainHandWeaponType = equippedBySlot.get("weapon")?.data.weaponType;
	const [fitBox, scale] = useFitScale(GRID_HEIGHT);
	return (
		<section className="relative min-h-0 rounded-md border border-white/40 p-3">
			<div
				ref={fitBox}
				className="flex h-full min-h-0 items-center justify-center"
			>
				<div
					className="grid shrink-0"
					style={scale === 1 ? GRID_STYLE : { ...GRID_STYLE, scale }}
				>
					{SLOT_CONFIG.map((cfg) => {
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
	item,
	broken,
	brokenReasons,
}: {
	cfg: SlotConfig;
	item: import("#/game/items/types").GeneratedItem | null;
	broken: boolean;
	brokenReasons: string[] | undefined;
}) {
	const innerSize = { w: cfg.size.w - 8, h: cfg.size.h - 8 };
	const frameClass = item
		? `border-2 bg-black ${broken ? BROKEN_BORDER : RARITY_BORDER[item.rarity]} ${broken ? BROKEN_GLOW : RARITY_GLOW[item.rarity]}`
		: "border border-white/30 bg-black/40";
	return (
		<div
			data-slot={cfg.slot}
			data-slot-area={cfg.area}
			style={{
				gridArea: cfg.area,
				width: cfg.size.w,
				height: cfg.size.h,
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
