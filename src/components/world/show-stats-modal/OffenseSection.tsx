import {
	effectiveCritChance,
	isAttackDualWielding,
	totalCritMultiplier,
} from "#/game/stats/compute";
import { estimateDps } from "#/game/stats/dps";
import type { ComputedCharacterStats, SwingProfile } from "#/game/stats/types";
import { m } from "#/paraglide/messages";

import { Row, SectionHeading } from "./Row";

/** DPS, speed, accuracy, crit, per-hand damage and the increased pools; "unarmed" with no swing. */
export function OffenseSection({ stats }: { stats: ComputedCharacterStats }) {
	if (stats.swings.length === 0 || stats.path === "unarmed") {
		return (
			<section>
				<SectionHeading>{m.stats_section_offense()}</SectionHeading>
				<p className="text-sm text-white/40">{m.stats_unarmed()}</p>
			</section>
		);
	}
	const heading =
		stats.path === "attack"
			? m.stats_section_offense_attack()
			: m.stats_section_offense_spell();
	const speed = stats.tickRate.toFixed(2);
	const swingsLabel = stats.swings
		.map((s) => (s.source === "mainHand" ? "MH" : "OH"))
		.join(" + ");

	const dps = estimateDps(stats);

	return (
		<section>
			<SectionHeading>{heading}</SectionHeading>
			<div className="grid grid-cols-2 gap-x-6">
				<div>
					<Row label={m.stats_dps()} value={dps} />
					<Row
						label={
							stats.path === "attack"
								? m.stats_attack_speed()
								: m.stats_cast_speed()
						}
						value={`${speed} /s`}
					/>
					<Row label={m.stats_accuracy()} value={stats.accuracy} />
					<Row
						label={m.stats_crit_chance()}
						value={`${effectiveCritChance(
							stats.swings[0]?.baseCritChance ?? 0,
							stats.increased.criticalChance,
						).toFixed(1)}%`}
					/>
					<Row
						label={m.stats_crit_multi()}
						value={`${totalCritMultiplier(stats.bonusCritMultiplier)}%`}
					/>
				</div>
				<div>
					<SwingDamageList stats={stats} />
					{stats.swings.length > 1 && (
						<p className="mt-2 text-xs text-white/40">
							{m.stats_dual_wield_pattern({ pattern: swingsLabel })}
						</p>
					)}
					{isAttackDualWielding(stats) && (
						<p className="mt-1 text-xs text-yellow-300/80">
							{m.stats_dual_wield_bonus()}
						</p>
					)}
				</div>
			</div>
			<IncreasedRows stats={stats} />
		</section>
	);
}

function SwingDamageList({ stats }: { stats: ComputedCharacterStats }) {
	if (stats.swings.length === 1) {
		return <SwingDamage swing={stats.swings[0]} label={m.stats_damage()} />;
	}
	return (
		<>
			<SwingDamage swing={stats.swings[0]} label={m.stats_main_hand()} />
			<div className="mt-2" />
			<SwingDamage swing={stats.swings[1]} label={m.stats_off_hand()} />
		</>
	);
}

function SwingDamage({ swing, label }: { swing: SwingProfile; label: string }) {
	return (
		<div>
			<div className="text-xs uppercase tracking-wider text-white/40">
				{label}
			</div>
			<Row
				label={m.element_physical()}
				value={`${swing.physicalDamage.min} – ${swing.physicalDamage.max}`}
			/>
			{swing.elementalDamage.map((e) => (
				<Row
					key={e.element}
					label={elementLabel(e.element)}
					value={`${e.min} – ${e.max}`}
				/>
			))}
		</div>
	);
}

function elementLabel(element: string): string {
	switch (element) {
		case "Cold":
			return m.element_cold();
		case "Fire":
			return m.element_fire();
		case "Lightning":
			return m.element_lightning();
		case "Void":
			return m.element_void();
		default:
			return element;
	}
}

function IncreasedRows({ stats }: { stats: ComputedCharacterStats }) {
	const i = stats.increased;
	const entries = [
		{ label: m.stats_increased_physical(), value: i.physical },
		{ label: m.stats_increased_cold(), value: i.cold },
		{ label: m.stats_increased_fire(), value: i.fire },
		{ label: m.stats_increased_lightning(), value: i.lightning },
		{ label: m.stats_increased_void(), value: i.void },
		{ label: m.stats_increased_elemental(), value: i.elementalGlobal },
		{
			label:
				stats.path === "attack"
					? m.stats_increased_attack_speed()
					: m.stats_increased_cast_speed(),
			value: stats.path === "attack" ? i.attackSpeed : i.castSpeed,
		},
		{
			label: m.stats_increased_global_crit_chance(),
			value: i.criticalChance,
		},
	].filter((e) => e.value !== 0);
	if (entries.length === 0) return null;
	return (
		<div className="mt-3 border-t border-white/10 pt-2">
			<div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-white/40">
				{m.stats_increased_header()}
			</div>
			<div className="grid grid-cols-2 gap-x-6">
				{entries.map((e) => (
					<div
						key={e.label}
						className="flex justify-between text-sm text-white"
					>
						<span className="text-white/60">{e.label}</span>
						<span className="tabular-nums">+{e.value}%</span>
					</div>
				))}
			</div>
		</div>
	);
}
