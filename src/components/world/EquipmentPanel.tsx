import ItemTooltip from "#/components/game/ItemTooltip";
import type { GeneratedItem } from "#/game/items/types";
import type { EquipmentType, WeaponType } from "#/game/items/types/base";
import InventoryButton from "./InventoryButton";

type Props = {
	weapon?: GeneratedItem | null;
};

type SlotArea =
	| "helmet"
	| "amulet"
	| "weapon"
	| "body"
	| "offhand"
	| "ring1"
	| "ring2"
	| "belt"
	| "gloves"
	| "boots";

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

// Emoji used for each weapon subtype when no art asset exists yet.
const WEAPON_EMOJI: Record<WeaponType, string> = {
	sword: "🗡️",
	greatsword: "⚔️",
	dagger: "🔪",
	bow: "🏹",
	axe: "🪓",
	mace: "🔨",
	twoHandedAxe: "🪓",
	staff: "🦯",
	wand: "🪄",
};

export default function EquipmentPanel({ weapon }: Props) {
	const weaponEmoji = weapon?.weaponType
		? WEAPON_EMOJI[weapon.weaponType]
		: null;

	return (
		<section className="relative rounded-md border border-white/40 p-3">
			<div className="flex h-full items-center justify-center">
				<div className="grid gap-2" style={SLOT_GRID_STYLE}>
					<EquipmentSlot type="helmet" label="HELM" area="helmet" />
					<EquipmentSlot
						type="amulet"
						label="AMU"
						area="amulet"
						w={80}
						h={80}
					/>
					<EquipmentSlot
						type="weapon"
						label="WPN"
						area="weapon"
						item={weapon ?? null}
						glyph={weaponEmoji}
					/>
					<EquipmentSlot type="chestplate" label="BODY" area="body" />
					<EquipmentSlot type="offhand" label="OFF" area="offhand" />
					<EquipmentSlot type="ring" label="RNG" area="ring1" w={80} h={80} />
					<EquipmentSlot type="belt" label="BELT" area="belt" w={120} h={50} />
					<EquipmentSlot type="ring" label="RNG" area="ring2" w={80} h={80} />
					<EquipmentSlot type="gloves" label="GLV" area="gloves" />
					<EquipmentSlot type="boots" label="BTS" area="boots" />
				</div>
			</div>
			<InventoryButton />
		</section>
	);
}

function EquipmentSlot({
	label,
	area,
	type,
	w,
	h,
	item,
	glyph,
}: {
	label: string;
	area: SlotArea;
	type: EquipmentType;
	w?: number;
	h?: number;
	item?: GeneratedItem | null;
	glyph?: string | null;
}) {
	const sized = w !== undefined && h !== undefined;
	const hasItem = !!item;
	return (
		<div
			data-slot={type}
			data-slot-area={area}
			style={{
				gridArea: area,
				...(sized
					? { width: w, height: h, placeSelf: "center" }
					: { width: "100%", height: "100%" }),
			}}
			className="group relative flex items-center justify-center rounded-sm border border-white/30 bg-black/40"
		>
			{hasItem && glyph ? (
				<span role="img" aria-label={item?.name ?? label} className="text-3xl">
					{glyph}
				</span>
			) : (
				<span className="text-[10px] uppercase tracking-wider text-white/40">
					{label}
				</span>
			)}
			{hasItem && item && (
				<div className="pointer-events-none absolute top-0 right-full z-50 mr-2 hidden group-hover:block">
					<ItemTooltip item={item} />
				</div>
			)}
		</div>
	);
}
