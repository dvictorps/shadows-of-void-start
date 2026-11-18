import type { ReactNode } from "react";

import { Button } from "#/components/ui/button";
import Tooltip from "#/components/ui/tooltip";

export type SlotSize = "lg" | "md";

const SLOT = {
	lg: { button: "hud-slot", art: "h-14 w-14", badge: "text-2xs" },
	md: { button: "hud-slot-md", art: "h-12 w-12", badge: "text-xs" },
} as const satisfies Record<
	SlotSize,
	{ button: string; art: string; badge: string }
>;

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
	onHover?: (hovered: boolean) => void;
	tooltip?: ReactNode;
	size?: SlotSize;
	className?: string;
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
