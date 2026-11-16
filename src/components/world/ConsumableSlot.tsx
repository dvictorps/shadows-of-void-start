import type { ReactNode } from "react";

import { Button } from "#/components/ui/button";
import Tooltip from "#/components/ui/tooltip";

/** `lg` is the combat HUD's slot; `md` / `sm` the status card's (wide / compact). */
export type SlotSize = "lg" | "md" | "sm";

const SLOT = {
	lg: { button: "hud-slot", art: "h-14 w-14", badge: "text-2xs" },
	md: { button: "hud-slot-md", art: "h-12 w-12", badge: "text-xs" },
	sm: { button: "hud-slot-sm", art: "h-8 w-8", badge: "text-xs" },
} as const satisfies Record<
	SlotSize,
	{ button: string; art: string; badge: string }
>;

/**
 * A consumable's button: its art (a sprite `art` sized to the slot, or any
 * `children`, like the incense icon), the count badge in the corner, an optional
 * tooltip, and hover / focus reported up (the combat HUD feeds the TextLog).
 * Shared by the combat HUD and the sidebar status card.
 */
export function ConsumableSlot({
	label,
	count,
	disabled,
	onUse,
	onHover,
	tooltip,
	size = "lg",
	className,
	art,
	children,
}: {
	label: string;
	count: number;
	disabled: boolean;
	onUse?: () => void;
	/** True on mouse enter / focus, false on leave / blur. */
	onHover?: (hovered: boolean) => void;
	tooltip?: ReactNode;
	size?: SlotSize;
	className?: string;
	/** Sprite URL, drawn at the slot's size. */
	art?: string;
	children?: ReactNode;
}) {
	const button = (
		<Button
			variant="hud"
			size={SLOT[size].button}
			onClick={onUse}
			onMouseEnter={() => onHover?.(true)}
			onMouseLeave={() => onHover?.(false)}
			onFocus={() => onHover?.(true)}
			onBlur={() => onHover?.(false)}
			disabled={disabled}
			aria-label={label}
			className={className}
		>
			{art && (
				<img
					src={art}
					alt=""
					draggable={false}
					className={`pointer-events-none select-none object-contain ${SLOT[size].art}`}
				/>
			)}
			{children}
			<span
				className={`absolute -bottom-1.5 -right-1.5 min-w-[1.25rem] border border-white/40 bg-black px-1 text-center leading-tight text-white ${SLOT[size].badge}`}
			>
				{count}
			</span>
		</Button>
	);
	return tooltip ? <Tooltip content={tooltip}>{button}</Tooltip> : button;
}
