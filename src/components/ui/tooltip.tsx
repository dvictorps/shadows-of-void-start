import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ReactNode } from "react";

type Props = {
	content: ReactNode;
	children: ReactNode;
	side?: "top" | "bottom" | "left" | "right";
};

// Game-styled tooltip: black bg, white border, pixel font, uppercase tracking.
// Use sparingly — every visible icon/counter that needs a short text hint.
// For rich item descriptions, use ItemTooltip instead.
export default function Tooltip({ content, children, side = "top" }: Props) {
	return (
		<TooltipPrimitive.Provider delayDuration={150}>
			<TooltipPrimitive.Root>
				<TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
				<TooltipPrimitive.Portal>
					<TooltipPrimitive.Content
						side={side}
						sideOffset={8}
						className="display-title z-50 max-w-xs border border-white/60 bg-black px-3 py-1.5 text-white/90 text-xs uppercase tracking-wider shadow-[0_0_8px_rgba(0,0,0,0.8)]"
					>
						{content}
					</TooltipPrimitive.Content>
				</TooltipPrimitive.Portal>
			</TooltipPrimitive.Root>
		</TooltipPrimitive.Provider>
	);
}
