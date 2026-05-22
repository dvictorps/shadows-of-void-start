import type { MonsterRarity } from "#/game/monsters";
import {
	translateEnemyName,
	translateMonsterModDescription,
} from "#/game/world/i18n";
import type { Enemy } from "#/hooks/useCombatLoop";

// Slim cousin of ItemTooltip. Rarity-tinted border + glow, header with the
// rolled-prefix name + level, body listing what each mod actually does.
// Only meaningful for magic / rare enemies — caller gates on enemy.rarity
// !== "normal" before mounting.

const RARITY_COLORS: Record<MonsterRarity, string> = {
	normal: "#c8c8c8",
	magic: "#8888ff",
	rare: "#ffff77",
};

const HEADER_BG: Record<MonsterRarity, string> = {
	normal: "transparent",
	magic: "rgba(56, 56, 120, 0.35)",
	rare: "rgba(120, 110, 30, 0.35)",
};

export default function MonsterTooltip({ enemy }: { enemy: Enemy }) {
	const color = RARITY_COLORS[enemy.rarity];
	const headerBg = HEADER_BG[enemy.rarity];

	return (
		<div
			className="pointer-events-none inline-block min-w-[220px] max-w-[320px] border bg-black text-sm leading-relaxed tracking-wide"
			style={{
				borderColor: color,
				boxShadow: `0 0 12px ${color}66, inset 0 0 8px ${color}22, 0 0 20px rgba(0,0,0,0.9)`,
			}}
		>
			<div className="h-[2px]" style={{ backgroundColor: color }} />
			<div
				className="display-title px-4 py-2 text-center uppercase tracking-[0.15em]"
				style={{
					background: `linear-gradient(to bottom, ${headerBg}, transparent)`,
				}}
			>
				<div className="text-lg" style={{ color }}>
					{translateEnemyName(enemy)}
				</div>
				<div
					className="text-xs uppercase tracking-[0.2em]"
					style={{ color: "rgba(255, 255, 255, 0.6)" }}
				>
					Lv {enemy.level}
				</div>
			</div>
			<div className="my-1 flex items-center gap-1.5 px-2">
				<div className="h-px flex-1 bg-white/20" />
				<div className="h-1 w-1 rotate-45 bg-white/40" />
				<div className="h-px flex-1 bg-white/20" />
			</div>
			<div className="space-y-0.5 px-4 pb-3 pt-1">
				{enemy.mods.map((modId) => (
					<div key={modId} style={{ color: "#8888ff" }}>
						{translateMonsterModDescription(modId)}
					</div>
				))}
			</div>
		</div>
	);
}
