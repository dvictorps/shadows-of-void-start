import { defensePreview } from "#/game/stats/defense-preview";
import type { ComputedCharacterStats } from "#/game/stats/types";
import { m } from "#/paraglide/messages";

import { Row, SectionHeading } from "./Row";

export function DefensesSection({
	stats,
	currentBarrier,
	currentLife,
	referenceEnemyLevel,
}: {
	stats: ComputedCharacterStats;
	currentBarrier: number;
	currentLife: number;
	referenceEnemyLevel: number;
}) {
	const preview = defensePreview(
		stats.armor,
		stats.evasion,
		referenceEnemyLevel,
	);
	return (
		<section>
			<SectionHeading>{m.stats_section_defenses()}</SectionHeading>
			<Row
				label={m.stats_life()}
				value={`${Math.ceil(currentLife)} / ${stats.maxLife}`}
			/>
			{stats.maxBarrier > 0 && (
				<Row
					label={m.stats_barrier()}
					value={`${Math.round(currentBarrier)} / ${Math.round(stats.maxBarrier)}`}
				/>
			)}
			<Row
				label={m.stats_armor()}
				value={
					<span>
						{stats.armor}
						<span className="ml-2 text-xs text-white/40">
							({Math.round(preview.armorReductionPct)}%)
						</span>
					</span>
				}
			/>
			<Row
				label={m.stats_evasion()}
				value={
					<span>
						{stats.evasion}
						<span className="ml-2 text-xs text-white/40">
							({Math.round(preview.evasionAvoidPct)}%)
						</span>
					</span>
				}
			/>
			<Row
				label={m.stats_resistance_cold()}
				value={`${stats.resistances.cold}%`}
			/>
			<Row
				label={m.stats_resistance_fire()}
				value={`${stats.resistances.fire}%`}
			/>
			<Row
				label={m.stats_resistance_lightning()}
				value={`${stats.resistances.lightning}%`}
			/>
			<Row
				label={m.stats_resistance_void()}
				value={`${stats.resistances.void}%`}
			/>
			<Row
				label={m.stats_life_regen()}
				value={`${stats.lifeRegen.toFixed(1)} /s`}
			/>
			{stats.blockChance > 0 && (
				<Row label={m.stats_block()} value={`${stats.blockChance}%`} />
			)}
		</section>
	);
}
