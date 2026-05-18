import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "#/components/ui/button";

export interface MenuAction {
	id: string;
	label: string;
	disabled?: boolean;
	onClick: () => void;
}

interface Props {
	/** Where to anchor the menu — usually the rect of the clicked item card. */
	anchor: { left: number; top: number; right: number; bottom: number };
	actions: MenuAction[];
	onClose: () => void;
}

const MENU_ESTIMATED_WIDTH = 220;

export default function ItemContextMenu({ anchor, actions, onClose }: Props) {
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const onDocPointerDown = (e: PointerEvent) => {
			if (!menuRef.current) return;
			if (menuRef.current.contains(e.target as Node)) return;
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

	const viewportWidth =
		typeof window !== "undefined" ? window.innerWidth : 1200;
	const rightCandidate = anchor.right + 8;
	const flipLeft = rightCandidate + MENU_ESTIMATED_WIDTH > viewportWidth;
	const left = flipLeft
		? Math.max(8, anchor.left - 8 - MENU_ESTIMATED_WIDTH)
		: rightCandidate;

	return createPortal(
		<div
			ref={menuRef}
			role="menu"
			style={{
				position: "fixed",
				left,
				top: anchor.top,
				zIndex: 1100,
				minWidth: MENU_ESTIMATED_WIDTH,
			}}
			className="flex flex-col gap-1 border border-white/30 bg-black p-1 shadow-[0_8px_24px_rgba(0,0,0,0.7)]"
		>
			{actions.map((action) => (
				<Button
					key={action.id}
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
			))}
		</div>,
		document.body,
	);
}
