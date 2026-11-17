import { elementName } from "#/game/combat/element-name";
import {
	effectiveCritChance,
	isAttackDualWielding,
	totalCritMultiplier,
} from "#/game/stats/compute";
import { estimateDps } from "#/game/stats/dps";
import type { ComputedCharacterStats, SwingProfile } from "#/game/stats/types";
import { m } from "#/paraglide/messages";

import { increasedPools } from "./increased-pools";
import { Row, SectionHeading } from "./Row";

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
		.map((s) =>
			s.source === "mainHand"
				? m.stats_main_hand_short()
				: m.stats_off_hand_short(),
		)
		.join(" + ");

	const dps = estimateDps(stats);
	const critChances = stats.swings
		.map(
			(s) =>
				`${effectiveCritChance(s.baseCritChance, stats.increased.criticalChance).toFixed(1)}%`,
		)
		.join(" / ");

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
					<Row label={m.stats_crit_chance()} value={critChances} />
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
				label={elementName("physical")}
				value={`${swing.physicalDamage.min} – ${swing.physicalDamage.max}`}
			/>
			{swing.elementalDamage.map((e) => (
				<Row
					key={e.element}
					label={elementName(e.element)}
					value={`${e.min} – ${e.max}`}
				/>
			))}
		</div>
	);
}

function IncreasedRows({ stats }: { stats: ComputedCharacterStats }) {
	const entries = increasedPools(stats);
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
