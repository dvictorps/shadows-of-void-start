import ItemCard, {
	BROKEN_BORDER,
	BROKEN_GLOW,
	RARITY_BORDER,
	RARITY_GLOW,
} from "#/components/game/ItemCard";
import { describeBrokenReasons } from "#/game/stats/compute";
import type { ComputedCharacterStats, EquippedSlot } from "#/game/stats/types";
import InventoryButton from "./InventoryButton";

type Props = {
	equippedBySlot: ReadonlyMap<
		EquippedSlot,
		{ id: string; data: import("#/game/items/types").GeneratedItem }
	>;
	stats: ComputedCharacterStats;
	characterLevel: number;
	onOpenInventory?: () => void;
};

type SlotConfig = {
	slot: EquippedSlot;
	area: string;
	label: string;
	size: { w: number; h: number };
};

const SLOT_CONFIG: SlotConfig[] = [
	{ slot: "helmet", area: "helmet", label: "ELMO", size: { w: 120, h: 120 } },
	{ slot: "amulet", area: "amulet", label: "AMU", size: { w: 80, h: 80 } },
	{ slot: "weapon", area: "weapon", label: "ARMA", size: { w: 120, h: 170 } },
	{
		slot: "chestplate",
		area: "body",
		label: "PEITO",
		size: { w: 120, h: 170 },
	},
	{ slot: "offhand", area: "offhand", label: "OFF", size: { w: 120, h: 170 } },
	{ slot: "ring1", area: "ring1", label: "ANEL", size: { w: 80, h: 80 } },
	{ slot: "belt", area: "belt", label: "CINTO", size: { w: 120, h: 50 } },
	{ slot: "ring2", area: "ring2", label: "ANEL", size: { w: 80, h: 80 } },
	{ slot: "gloves", area: "gloves", label: "LUVA", size: { w: 120, h: 120 } },
	{ slot: "boots", area: "boots", label: "BOTA", size: { w: 120, h: 120 } },
];

const SLOT_GRID_STYLE = {
	gridTemplateColumns: "120px 120px 120px",
	gridTemplateRows: "120px 170px 80px 120px",
	gridTemplateAreas: `
		".      helmet amulet"
		"weapon body   offhand"
		"ring1  belt   ring2"
		"gloves .      boots"
	`,
} as const;

export default function EquipmentPanel({
	equippedBySlot,
	stats,
	characterLevel,
	onOpenInventory,
}: Props) {
	return (
		<section className="relative rounded-md border border-white/40 p-3">
			<div className="flex h-full items-center justify-center">
				<div className="grid gap-2" style={SLOT_GRID_STYLE}>
					{SLOT_CONFIG.map((cfg) => {
						const entry = equippedBySlot.get(cfg.slot);
						const broken = entry ? stats.brokenItemIds.has(entry.id) : false;
						const reasons =
							broken && entry
								? describeBrokenReasons(entry.data, stats, characterLevel)
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
	const slotSize = Math.min(cfg.size.w, cfg.size.h);
	// Paper-doll convention: the SLOT carries the rarity color + inset glow when
	// filled. The ItemCard inside renders frameless so we don't get a doubled
	// border. Empty slots stay neutral (border-white/30 + bg-black/40).
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
					size={slotSize - 8}
					broken={broken}
					brokenReasons={brokenReasons}
					frameless
				/>
			) : (
				<span className="text-[10px] uppercase tracking-wider text-white/40">
					{cfg.label}
				</span>
			)}
		</div>
	);
}
