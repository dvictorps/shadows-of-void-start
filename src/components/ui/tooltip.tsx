import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ReactNode } from "react";

import { useGameStage } from "#/components/game-stage/context";

type Props = {
	content: ReactNode;
	children: ReactNode;
	side?: "top" | "bottom" | "left" | "right";
};

export default function Tooltip({ content, children, side = "top" }: Props) {
	const stage = useGameStage();
	return (
		<TooltipPrimitive.Root>
			<TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
			<TooltipPrimitive.Portal container={stage.container}>
				<TooltipPrimitive.Content
					side={side}
					sideOffset={8}
					className="display-title z-50 max-w-xs border border-white/60 bg-black px-3 py-1.5 text-white/90 text-xs uppercase tracking-wider shadow-tooltip"
				>
					{content}
				</TooltipPrimitive.Content>
			</TooltipPrimitive.Portal>
		</TooltipPrimitive.Root>
	);
}
