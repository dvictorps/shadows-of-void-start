import { Fragment, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "#/components/ui/button";

export interface MenuAction {
	id: string;
	label: string;
	disabled?: boolean;
	onClick: () => void;
	/** Renders a thin separator above this action — groups it visually apart. */
	dividerBefore?: boolean;
}

interface Props {
	/** Where to anchor the menu — usually the rect of the clicked item card. */
	anchor: { left: number; top: number; right: number; bottom: number };
	actions: MenuAction[];
	onClose: () => void;
}

const MENU_ESTIMATED_WIDTH = 220;
const MENU_OFFSET_PX = 6;
// 1px line + my-1 (4px top + 4px bottom) = 9px total vertical footprint
const DIVIDER_HEIGHT_PX = 9;
const DIVIDER_CLASS = "my-1 h-px bg-white/15";

export default function ItemContextMenu({ anchor, actions, onClose }: Props) {
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const onDocPointerDown = (e: PointerEvent) => {
			if (!menuRef.current) return;
			if (e.target instanceof Node && menuRef.current.contains(e.target))
				return;
			onClose();
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("pointerdown", onDocPointerDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("pointerdown", onDocPointerDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [onClose]);

	// Anchor below the card so the item's right-side tooltip stays visible.
	// Estimate menu height as N actions × ~36px each + container padding; flip
	// above if there's not enough room below.
	const viewportHeight =
		typeof window !== "undefined" ? window.innerHeight : 800;
	const viewportWidth =
		typeof window !== "undefined" ? window.innerWidth : 1200;
	const dividerCount = actions.filter((a) => a.dividerBefore).length;
	const estimatedHeight =
		12 + actions.length * 36 + dividerCount * DIVIDER_HEIGHT_PX;
	const belowCandidate = anchor.bottom + MENU_OFFSET_PX;
	const flipAbove = belowCandidate + estimatedHeight > viewportHeight;
	const top = flipAbove
		? Math.max(8, anchor.top - MENU_OFFSET_PX - estimatedHeight)
		: belowCandidate;
	const left = Math.min(
		Math.max(8, anchor.left),
		viewportWidth - MENU_ESTIMATED_WIDTH - 8,
	);

	return createPortal(
		<div
			ref={menuRef}
			role="menu"
			style={{
				position: "fixed",
				left,
				top,
				zIndex: 1100,
				minWidth: MENU_ESTIMATED_WIDTH,
			}}
			className="flex flex-col gap-1 border border-white/30 bg-black p-1 shadow-[0_8px_24px_rgba(0,0,0,0.7)]"
		>
			{actions.map((action) => (
				<Fragment key={action.id}>
					{action.dividerBefore && (
						<div className={DIVIDER_CLASS} aria-hidden />
					)}
					<Button
						type="button"
						variant="stark"
						disabled={action.disabled}
						onClick={() => {
							action.onClick();
							onClose();
						}}
						className="justify-start px-3 py-1.5 text-xs uppercase tracking-wider"
					>
						{action.label}
					</Button>
				</Fragment>
			))}
		</div>,
		document.body,
	);
}
