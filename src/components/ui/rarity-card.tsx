import type { ReactNode } from "react";
import type { ItemRarity } from "#/game/items/types";

// Keyed by ItemRarity (the superset). MonsterRarity overlaps on
// normal/magic/rare/unique. The `unique` entry is a fallback (used for
// future unique items + as the seed color for bosses that don't override
// via BossConfig.nameplateColor).
//
// showGlow toggles the "premium chrome" treatment (top accent stripe +
// colored border + colored box-shadow). ItemTooltip passes true only for
// legendary/epic/unique; MonsterTooltip passes true always.

export const RARITY_COLORS: Record<ItemRarity, string> = {
	normal: "#c8c8c8",
	magic: "#8888ff",
	rare: "#ffff77",
	legendary: "#dc143c",
	epic: "#1eff00",
	unique: "#af6025",
};

export const RARITY_HEADER_BG: Record<ItemRarity, string> = {
	normal: "transparent",
	magic: "rgba(56, 56, 120, 0.35)",
	rare: "rgba(120, 110, 30, 0.35)",
	legendary: "rgba(140, 10, 30, 0.3)",
	epic: "rgba(15, 130, 0, 0.3)",
	unique: "rgba(95, 50, 15, 0.35)",
};

export function TooltipSeparator() {
	return (
		<div className="my-1 flex items-center gap-1.5 px-2">
			<div className="h-px flex-1 bg-white/20" />
			<div className="h-1 w-1 rotate-45 bg-white/40" />
			<div className="h-px flex-1 bg-white/20" />
		</div>
	);
}

export function RarityCard({
	rarity,
	showGlow = false,
	className = "",
	children,
}: {
	rarity: ItemRarity;
	showGlow?: boolean;
	className?: string;
	children: ReactNode;
}) {
	const color = RARITY_COLORS[rarity];
	const borderColor = showGlow ? color : "rgba(255, 255, 255, 0.4)";
	const glowStyle = showGlow
		? {
				borderColor,
				boxShadow: `0 0 12px ${color}66, inset 0 0 8px ${color}22, 0 0 20px rgba(0,0,0,0.9)`,
			}
		: { boxShadow: "0 0 20px rgba(0,0,0,0.9)" };

	return (
		<div
			className={`relative inline-block border bg-black text-sm leading-relaxed tracking-wide ${className}`}
			style={{ borderColor, ...glowStyle }}
		>
			{showGlow && (
				<div className="h-[2px]" style={{ backgroundColor: color }} />
			)}
			{children}
		</div>
	);
}

export function RarityHeader({
	rarity,
	children,
}: {
	rarity: ItemRarity;
	children: ReactNode;
}) {
	return (
		<div
			className="display-title px-4 py-2 text-center uppercase tracking-[0.15em]"
			style={{
				background: `linear-gradient(to bottom, ${RARITY_HEADER_BG[rarity]}, transparent)`,
			}}
		>
			{children}
		</div>
	);
}
