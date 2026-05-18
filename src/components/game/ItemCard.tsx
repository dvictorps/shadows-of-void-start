import { AlertTriangle } from "lucide-react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import ItemTooltip from "#/components/game/ItemTooltip";
import type { GeneratedItem, ItemRarity } from "#/game/items/types";
import type { EquipmentType, WeaponType } from "#/game/items/types/base";

// Slot framing for empty cells — kept neutral gray so rarity glow on filled
// slots is what draws the eye.
export const SLOT_EMPTY = "border border-white/15 bg-black/40";

export const RARITY_BORDER: Record<ItemRarity, string> = {
	normal: "border-[#3a4658]",
	magic: "border-[#5577cc]",
	rare: "border-[#b39800]",
	legendary: "border-[#dc143c]",
	epic: "border-[#1eff00]",
};

export const RARITY_GLOW: Record<ItemRarity, string> = {
	normal: "shadow-[inset_0_0_10px_rgba(60,130,200,0.18)]",
	magic:
		"shadow-[inset_0_0_14px_rgba(100,140,220,0.55),0_0_10px_rgba(100,140,220,0.35)]",
	rare: "shadow-[inset_0_0_14px_rgba(220,200,80,0.5),0_0_10px_rgba(220,200,80,0.35)]",
	legendary:
		"shadow-[inset_0_0_16px_rgba(220,40,80,0.55),0_0_16px_rgba(220,40,80,0.55)] animate-[item-pulse_2s_ease-in-out_infinite]",
	epic: "shadow-[inset_0_0_16px_rgba(60,255,40,0.55),0_0_16px_rgba(60,255,40,0.55)] animate-[item-pulse_1.6s_ease-in-out_infinite]",
};

export const BROKEN_BORDER = "border-red-500";
export const BROKEN_GLOW =
	"shadow-[inset_0_0_12px_rgba(220,40,40,0.35),0_0_10px_rgba(220,40,40,0.35)]";

const EQUIPMENT_EMOJI: Record<EquipmentType, string> = {
	weapon: "⚔️",
	offhand: "🛡️",
	helmet: "🪖",
	chestplate: "🎽",
	boots: "👢",
	gloves: "🧤",
	ring: "💍",
	amulet: "📿",
	belt: "🎗️",
};

const WEAPON_EMOJI_OVERRIDE: Record<WeaponType, string> = {
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

function emojiFor(item: GeneratedItem): string {
	if (item.weaponType && WEAPON_EMOJI_OVERRIDE[item.weaponType]) {
		return WEAPON_EMOJI_OVERRIDE[item.weaponType];
	}
	const equipmentType = item.equipmentType as EquipmentType;
	return EQUIPMENT_EMOJI[equipmentType] ?? "❓";
}

type Props = {
	item?: GeneratedItem | null;
	size?: number;
	dimmed?: boolean;
	suppressTooltip?: boolean;
	/** Equipped-but-requirements-unmet state. Renders red border + warn icon. */
	broken?: boolean;
	/** Lines shown in red at the top of the tooltip when broken. */
	brokenReasons?: string[];
	/**
	 * Render only the emoji + badge/tooltip, no own border or background. Used
	 * when the parent (e.g. paper-doll slot) supplies the rarity-colored frame.
	 */
	frameless?: boolean;
	/** Click handler — receives the card's bounding rect for positioning popovers. */
	onClick?: (rect: DOMRect) => void;
};

const TOOLTIP_OFFSET_PX = 12;
// Rough estimate of the tooltip width — used so we can flip the tooltip to the
// left side when the card is too close to the right edge of the viewport.
const TOOLTIP_ESTIMATED_WIDTH = 280;

export default function ItemCard({
	item,
	size = 64,
	dimmed,
	suppressTooltip,
	broken,
	brokenReasons,
	frameless,
	onClick,
}: Props) {
	const cardRef = useRef<HTMLButtonElement>(null);
	const [tooltipPos, setTooltipPos] = useState<{
		left: number;
		top: number;
	} | null>(null);
	// Drop the tooltip the instant suppression kicks in (e.g. a drag starts).
	if (suppressTooltip && tooltipPos) setTooltipPos(null);

	if (!item) {
		return (
			<div
				style={{ width: size, height: size }}
				className={`rounded-md ${SLOT_EMPTY}`}
			/>
		);
	}

	const handleEnter = () => {
		if (suppressTooltip) return;
		const rect = cardRef.current?.getBoundingClientRect();
		if (!rect) return;
		const viewportWidth = window.innerWidth;
		// Default: render to the right; flip left if it would clip the viewport.
		const rightCandidate = rect.right + TOOLTIP_OFFSET_PX;
		const flipLeft = rightCandidate + TOOLTIP_ESTIMATED_WIDTH > viewportWidth;
		const left = flipLeft
			? Math.max(8, rect.left - TOOLTIP_OFFSET_PX - TOOLTIP_ESTIMATED_WIDTH)
			: rightCandidate;
		setTooltipPos({ left, top: rect.top });
	};

	const handleLeave = () => setTooltipPos(null);

	const cardClasses = [
		"relative flex items-center justify-center rounded-md transition-colors",
		frameless
			? "bg-transparent"
			: [
					"border-2 bg-black",
					broken ? BROKEN_BORDER : RARITY_BORDER[item.rarity],
					broken ? BROKEN_GLOW : RARITY_GLOW[item.rarity],
				].join(" "),
		dimmed ? "opacity-40 grayscale" : "",
		onClick ? "cursor-pointer" : "cursor-default",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<>
			<button
				ref={cardRef}
				type="button"
				onClick={() => {
					if (!onClick) return;
					const rect = cardRef.current?.getBoundingClientRect();
					if (rect) onClick(rect);
				}}
				onMouseEnter={handleEnter}
				onMouseLeave={handleLeave}
				onFocus={handleEnter}
				onBlur={handleLeave}
				// Don't disable the button when there's no onClick — disabled buttons
				// don't fire pointer events, which would kill the hover tooltip on
				// inventory/bag items that are view-only.
				style={{ width: size, height: size }}
				className={cardClasses}
				aria-label={item.name}
			>
				<span
					className="select-none"
					style={{ fontSize: Math.floor(size * 0.55) }}
				>
					{emojiFor(item)}
				</span>
				{broken && (
					<span className="pointer-events-none absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-black bg-red-500 text-black shadow-[0_0_6px_rgba(220,40,40,0.7)]">
						<AlertTriangle size={12} strokeWidth={3} />
					</span>
				)}
			</button>
			{tooltipPos &&
				createPortal(
					<div
						style={{
							position: "fixed",
							left: tooltipPos.left,
							top: tooltipPos.top,
							zIndex: 1000,
							pointerEvents: "none",
						}}
					>
						<ItemTooltip item={item} brokenReasons={brokenReasons} />
					</div>,
					document.body,
				)}
		</>
	);
}
