import { m } from "#/paraglide/messages";

import { fillPercent } from "./fill-percent";

/** `hud` is the combat HUD's bar; `md` / `sm` the status card's (wide / compact). */
export type XpBarSize = "hud" | "md" | "sm";

const SIZE = {
	hud: { label: "text-[10px]", track: "h-3" },
	md: { label: "text-sm", track: "h-2" },
	sm: { label: "text-xs", track: "h-2" },
} as const satisfies Record<XpBarSize, { label: string; track: string }>;

/**
 * The XP readout: the "XP current / needed" label over a yellow progress
 * track. Shared by the combat HUD and the sidebar status card.
 */
export function XpBar({
	xp,
	xpNeeded,
	size,
}: {
	xp: number;
	xpNeeded: number;
	size: XpBarSize;
}) {
	return (
		<div className="flex-1 space-y-1">
			<div
				className={`uppercase tracking-wider text-yellow-300/80 ${SIZE[size].label}`}
			>
				{m.status_xp_label({ current: xp, needed: xpNeeded })}
			</div>
			<div
				role="progressbar"
				aria-label={m.xp_bar_aria()}
				aria-valuenow={xp}
				aria-valuemin={0}
				aria-valuemax={xpNeeded}
				className={`w-full overflow-hidden rounded-full bg-white/10 ${SIZE[size].track}`}
			>
				<div
					className="h-full bg-yellow-300 transition-[width] duration-200"
					style={{ width: `${fillPercent(xp, xpNeeded)}%` }}
				/>
			</div>
		</div>
	);
}
