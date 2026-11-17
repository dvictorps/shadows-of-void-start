import { AlertTriangle } from "lucide-react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";

import ItemTooltip from "#/components/game/ItemTooltip";
import { Button } from "#/components/ui/button";
import { TEMPLATE_BY_ID } from "#/game/items/data/templates";
import { translateItemName } from "#/game/items/item-name";
import type { GeneratedItem, ItemRarity } from "#/game/items/types";
import type { EquipmentType, WeaponType } from "#/game/items/types/base";

// Slot framing for empty cells — kept neutral gray so rarity glow on filled
// slots is what draws the eye.
export const SLOT_EMPTY = "border border-white/15 bg-black/40";

export const RARITY_BORDER = {
	normal: "border-[#3a4658]",
	magic: "border-[#5577cc]",
	rare: "border-[#b39800]",
	legendary: "border-[#dc143c]",
	epic: "border-[#1eff00]",
	unique: "border-[#af6025]",
} satisfies Record<ItemRarity, string>;

export const RARITY_GLOW = {
	normal: "shadow-[inset_0_0_10px_rgba(60,130,200,0.18)]",
	magic:
		"shadow-[inset_0_0_14px_rgba(100,140,220,0.55),0_0_10px_rgba(100,140,220,0.35)]",
	rare: "shadow-[inset_0_0_14px_rgba(220,200,80,0.5),0_0_10px_rgba(220,200,80,0.35)]",
	legendary:
		"shadow-[inset_0_0_16px_rgba(220,40,80,0.55),0_0_16px_rgba(220,40,80,0.55)] animate-[item-pulse_2s_ease-in-out_infinite]",
	epic: "shadow-[inset_0_0_16px_rgba(60,255,40,0.55),0_0_16px_rgba(60,255,40,0.55)] animate-[item-pulse_1.6s_ease-in-out_infinite]",
	unique:
		"shadow-[inset_0_0_14px_rgba(175,96,37,0.55),0_0_10px_rgba(175,96,37,0.45)]",
} satisfies Record<ItemRarity, string>;

export const BROKEN_BORDER = "border-red-500";
export const BROKEN_GLOW =
	"shadow-[inset_0_0_12px_rgba(220,40,40,0.35),0_0_10px_rgba(220,40,40,0.35)]";

const EQUIPMENT_EMOJI = {
	weapon: "⚔️",
	offhand: "🛡️",
	tome: "📖",
	quiver: "🏹",
	helmet: "🪖",
	chestplate: "🎽",
	boots: "👢",
	gloves: "🧤",
	ring: "💍",
	amulet: "📿",
	belt: "🎗️",
} satisfies Record<EquipmentType, string>;

const WEAPON_EMOJI_OVERRIDE = {
	sword: "🗡️",
	greatsword: "⚔️",
	dagger: "🔪",
	bow: "🏹",
	axe: "🪓",
	mace: "🔨",
	twoHandedAxe: "🪓",
	staff: "🦯",
	wand: "🪄",
} satisfies Record<WeaponType, string>;

type ItemIcon =
	| { kind: "sprite"; src: string }
	| { kind: "emoji"; char: string };

function iconFor(item: GeneratedItem): ItemIcon {
	// Hand-authored items (starter gear) carry their own icon since they have
	// no template entry.
	if (item.icon) return { kind: "sprite", src: item.icon };
	const tpl = TEMPLATE_BY_ID.get(item.templateId);
	if (tpl?.icon) return { kind: "sprite", src: tpl.icon };
	if (item.weaponType && WEAPON_EMOJI_OVERRIDE[item.weaponType]) {
		return { kind: "emoji", char: WEAPON_EMOJI_OVERRIDE[item.weaponType] };
	}
	return { kind: "emoji", char: EQUIPMENT_EMOJI[item.equipmentType] ?? "❓" };
}

type Props = {
	item?: GeneratedItem | null;
	// Number = square card. Object = rectangular (paper-doll slots that match the
	// sprite's aspect ratio, e.g., 120×170 for weapon/chest/offhand).
	size?: number | { w: number; h: number };
	dimmed?: boolean;
	/**
	 * Selected-for-action overlay. Renders a glowing white ring on top of the
	 * card's normal rarity frame. Used by selection-grid modals (pickup loot,
	 * vendor sell, etc) to indicate which items the action will apply to,
	 * without graying-out the unselected items.
	 */
	selected?: boolean;
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
	/**
	 * A rect (in viewport coords) the tooltip should not overlap. Used by the
	 * inventory modal to push the tooltip past an open context menu instead of
	 * letting it slide behind it.
	 */
	avoidRect?: DOMRect | null;
};

const TOOLTIP_OFFSET_PX = 12;
// Rough estimate of the tooltip width — used so we can flip the tooltip to the
// left side when the card is too close to the right edge of the viewport.
const TOOLTIP_ESTIMATED_WIDTH = 280;

function tooltipOverlapsAvoid(tooltipLeft: number, avoid: DOMRect): boolean {
	const tooltipRight = tooltipLeft + TOOLTIP_ESTIMATED_WIDTH;
	return tooltipLeft < avoid.right && tooltipRight > avoid.left;
}

function isSquareSize(size: number | { w: number; h: number }): size is number {
	return typeof size === "number";
}

function computeTooltipLeft(
	cardRect: DOMRect,
	avoid: DOMRect | null | undefined,
	viewportWidth: number,
): number {
	let leftCandidate = cardRect.right + TOOLTIP_OFFSET_PX;
	if (avoid && tooltipOverlapsAvoid(leftCandidate, avoid)) {
		leftCandidate = avoid.right + TOOLTIP_OFFSET_PX;
	}
	const flipLeft = leftCandidate + TOOLTIP_ESTIMATED_WIDTH > viewportWidth;
	if (!flipLeft) return leftCandidate;
	let flippedLeft = cardRect.left - TOOLTIP_OFFSET_PX - TOOLTIP_ESTIMATED_WIDTH;
	if (avoid && tooltipOverlapsAvoid(flippedLeft, avoid)) {
		flippedLeft = avoid.left - TOOLTIP_OFFSET_PX - TOOLTIP_ESTIMATED_WIDTH;
	}
	return Math.max(8, flippedLeft);
}

export default function ItemCard({
	item,
	size = 64,
	dimmed,
	selected,
	suppressTooltip,
	broken,
	brokenReasons,
	frameless,
	onClick,
	avoidRect,
}: Props) {
	const width = isSquareSize(size) ? size : size.w;
	const height = isSquareSize(size) ? size : size.h;
	const cardRef = useRef<HTMLButtonElement>(null);
	// The card's rect, measured on hover. The tooltip position is derived from
	// it at render time so a changed avoidRect (context menu opening/closing)
	// repositions the tooltip without re-firing hover.
	const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
	// Drop the tooltip the instant suppression kicks in (e.g. a drag starts).
	if (suppressTooltip && anchorRect) setAnchorRect(null);
	const tooltipPos = anchorRect && {
		left: computeTooltipLeft(anchorRect, avoidRect, window.innerWidth),
		top: anchorRect.top,
	};

	if (!item) {
		return (
			<div style={{ width, height }} className={`rounded-md ${SLOT_EMPTY}`} />
		);
	}

	const handleEnter = () => {
		if (suppressTooltip) return;
		const rect = cardRef.current?.getBoundingClientRect();
		if (!rect) return;
		setAnchorRect(rect);
	};

	const handleLeave = () => setAnchorRect(null);

	const cardClasses = [
		frameless
			? "bg-transparent"
			: [
					"border-2 bg-black",
					broken ? BROKEN_BORDER : RARITY_BORDER[item.rarity],
					broken ? BROKEN_GLOW : RARITY_GLOW[item.rarity],
				].join(" "),
		dimmed ? "opacity-40 grayscale" : "",
		// Selection overlay — white so it reads distinctly from the rarity frame
		// underneath. Yellow would collide visually with rare-tier items
		// (#b39800 border + golden glow). Inset keeps the rarity color visible
		// at the very edge.
		selected
			? "ring-2 ring-white ring-inset shadow-[0_0_14px_rgba(255,255,255,0.55)]"
			: "",
		onClick ? "cursor-pointer" : "cursor-default",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<>
			<Button
				ref={cardRef}
				type="button"
				variant="item"
				size="inline"
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
				style={{ width, height }}
				className={cardClasses}
				aria-label={translateItemName(item)}
			>
				{(() => {
					const icon = iconFor(item);
					if (icon.kind === "sprite") {
						// Rings + amulets are physically tiny objects vs. weapons/armor —
						// render them at half scale so they don't visually dominate the
						// grid. Belts are jewelry for stat purposes but render full-scale.
						const isTinyJewelry =
							item.equipmentType === "ring" || item.equipmentType === "amulet";
						return (
							<img
								src={icon.src}
								alt=""
								draggable={false}
								className={`pointer-events-none h-full w-full select-none object-contain p-1.5 ${isTinyJewelry ? "scale-50" : ""}`}
							/>
						);
					}
					return (
						<span
							className="select-none"
							style={{ fontSize: Math.floor(Math.min(width, height) * 0.55) }}
						>
							{icon.char}
						</span>
					);
				})()}
				{broken && (
					<span className="pointer-events-none absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-black bg-red-500 text-black shadow-[0_0_6px_rgba(220,40,40,0.7)]">
						<AlertTriangle className="size-3" strokeWidth={3} />
					</span>
				)}
			</Button>
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
