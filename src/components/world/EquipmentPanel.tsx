import type { EquipmentType } from "#/game/items/types/base";
import InventoryButton from "./InventoryButton";

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

export default function EquipmentPanel() {
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
					<EquipmentSlot type="weapon" label="WPN" area="weapon" />
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
}: {
	label: string;
	area: SlotArea;
	type: EquipmentType;
	w?: number;
	h?: number;
}) {
	const sized = w !== undefined && h !== undefined;
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
			className="flex items-center justify-center rounded-sm border border-white/30 bg-black/40 text-[10px] uppercase tracking-wider text-white/40"
		>
			{label}
		</div>
	);
}
