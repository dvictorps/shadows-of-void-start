import {
	RARITY_COLORS,
	RarityCard,
	RarityHeader,
	TooltipSeparator,
} from "#/components/ui/rarity-card";
import {
	translateEnemyName,
	translateMonsterModDescription,
} from "#/game/world/i18n";
import type { Enemy } from "#/hooks/useCombatLoop";

// Slim cousin of ItemTooltip. Rarity-tinted shell + header with the rolled
// name + level, body listing what each mod does. Only meaningful for magic /
// rare enemies — caller gates on enemy.rarity !== "normal" before mounting.

export default function MonsterTooltip({ enemy }: { enemy: Enemy }) {
	const color = RARITY_COLORS[enemy.rarity];
	return (
		<RarityCard
			rarity={enemy.rarity}
			showGlow
			className="pointer-events-none min-w-[220px] max-w-[320px]"
		>
			<RarityHeader rarity={enemy.rarity}>
				<div className="text-lg" style={{ color }}>
					{translateEnemyName(enemy)}
				</div>
				<div
					className="text-xs uppercase tracking-[0.2em]"
					style={{ color: "rgba(255, 255, 255, 0.6)" }}
				>
					Lv {enemy.level}
				</div>
			</RarityHeader>
			<TooltipSeparator />
			<div className="space-y-0.5 px-4 pt-1 pb-3">
				{enemy.mods.map((modId) => (
					<div key={modId} style={{ color: RARITY_COLORS.magic }}>
						{translateMonsterModDescription(modId, enemy.level)}
					</div>
				))}
			</div>
		</RarityCard>
	);
}
