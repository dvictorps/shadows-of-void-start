import {
	RARITY_COLORS,
	RarityCard,
	RarityHeader,
	TooltipSeparator,
} from "#/components/game/rarity-card";
import type { BossConfig } from "#/game/bosses";
import { elementName } from "#/game/combat/element-name";
import {
	translateEnemyName,
	translateMonsterModDescription,
} from "#/game/world/i18n";
import type { Enemy } from "#/hooks/useCombatLoop";
import { intlLocale } from "#/lib/format";
import { m } from "#/paraglide/messages";

type ElementKey = "fire" | "cold" | "lightning" | "void";

interface ResistanceDisplay {
	text: string;
	color: string;
}

function formatResistance(value: number): ResistanceDisplay {
	if (value > 0)
		return { text: `+${value}%`, color: "rgba(180, 220, 180, 0.95)" };
	if (value < 0)
		return { text: `${value}%`, color: "rgba(255, 120, 110, 0.95)" };
	return { text: "0%", color: "rgba(200, 200, 200, 0.7)" };
}

function BossStatSheet({ enemy }: { enemy: Enemy }) {
	const { scaled } = enemy;
	const phys = scaled.physicalDamage;
	const elems = scaled.elementalDamage;
	const res = scaled.resistances;
	const elementKeys: ElementKey[] = ["fire", "cold", "lightning", "void"];
	return (
		<div className="space-y-1 px-4 pt-1 pb-3 text-[0.92em]">
			<div style={{ color: "rgba(220, 220, 220, 0.95)" }}>
				{m.stat_hp()}: {scaled.hp.toLocaleString(intlLocale())}
			</div>
			<div style={{ color: "rgba(220, 220, 220, 0.95)" }}>
				{m.stat_attack_speed()}: {scaled.attackSpeed.toFixed(2)}/s
			</div>
			{(phys.min > 0 || phys.max > 0) && (
				<div style={{ color: "rgba(220, 220, 220, 0.95)" }}>
					{m.stat_physical_damage()}:{" "}
					<span style={{ color: "#c8c8c8" }}>
						{phys.min}–{phys.max}
					</span>
				</div>
			)}
			{elems.map((e) => (
				<div key={e.element} style={{ color: "rgba(220, 220, 220, 0.95)" }}>
					{m.stat_element_damage({
						element: elementName(e.element),
					})}
					:{" "}
					<span style={{ color: "#ffaa66" }}>
						{e.min}–{e.max}
					</span>
				</div>
			))}
			<div className="pt-1" style={{ color: "rgba(200, 200, 200, 0.8)" }}>
				{m.stat_resistances()}
			</div>
			{elementKeys.map((key) => {
				const formatted = formatResistance(res[key]);
				return (
					<div
						key={key}
						className="flex justify-between"
						style={{ color: "rgba(220, 220, 220, 0.95)" }}
					>
						<span>{elementName(key)}</span>
						<span style={{ color: formatted.color }}>{formatted.text}</span>
					</div>
				);
			})}
		</div>
	);
}

export default function MonsterTooltip({
	enemy,
	bossConfig = null,
}: {
	enemy: Enemy;
	bossConfig?: BossConfig | null;
}) {
	const headerColor = bossConfig
		? bossConfig.nameplateColor
		: RARITY_COLORS[enemy.rarity];
	return (
		<RarityCard
			rarity={enemy.rarity}
			showGlow
			className="pointer-events-none min-w-[220px] max-w-[320px]"
		>
			<RarityHeader rarity={enemy.rarity}>
				<div className="text-lg" style={{ color: headerColor }}>
					{translateEnemyName(enemy)}
				</div>
				<div
					className="text-xs uppercase tracking-[0.2em]"
					style={{ color: "rgba(255, 255, 255, 0.6)" }}
				>
					{m.level_short({ level: enemy.level })}
				</div>
			</RarityHeader>
			<TooltipSeparator />
			{enemy.rarity === "unique" ? (
				<BossStatSheet enemy={enemy} />
			) : (
				<div className="space-y-0.5 px-4 pt-1 pb-3">
					{enemy.mods.map((modId) => (
						<div key={modId} style={{ color: RARITY_COLORS.magic }}>
							{translateMonsterModDescription(modId, enemy.scaled)}
						</div>
					))}
				</div>
			)}
		</RarityCard>
	);
}
