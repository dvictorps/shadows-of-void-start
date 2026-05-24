import Modal from "#/components/Modal";
import Tooltip from "#/components/ui/tooltip";
import {
	computeArmorMitigation,
	computeEvasionAvoid,
	DEX_ACCURACY_PER_POINT,
	DEX_EVASION_PCT_PER_POINT,
	effectiveCritChance,
	INT_BARRIER_PCT_PER_POINT,
	isAttackDualWielding,
	STR_LIFE_PER_POINT,
	STR_MELEE_PCT_PER_POINT,
	totalCritMultiplier,
} from "#/game/stats/compute";
import type { ComputedCharacterStats, SwingProfile } from "#/game/stats/types";
import { m } from "#/paraglide/messages";

type Props = {
	isOpen: boolean;
	onClose: () => void;
	stats: ComputedCharacterStats;
	/** Reference enemy level for derived mitigation/hit-chance previews. */
	referenceEnemyLevel: number;
	/** Current barrier value (live). */
	currentBarrier: number;
	/** Current life. */
	currentLife: number;
};

export default function ShowStatsModal({
	isOpen,
	onClose,
	stats,
	referenceEnemyLevel,
	currentBarrier,
	currentLife,
}: Props) {
	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={m.stats_title()}
			className="max-w-3xl"
		>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				<AttributesSection stats={stats} />
				<DefensesSection
					stats={stats}
					currentBarrier={currentBarrier}
					currentLife={currentLife}
					referenceEnemyLevel={referenceEnemyLevel}
				/>
			</div>
			<hr className="my-4 border-white/15" />
			<OffenseSection stats={stats} />
			<hr className="my-4 border-white/15" />
			<UtilitySection stats={stats} />
		</Modal>
	);
}

function SectionHeading({ children }: { children: React.ReactNode }) {
	return (
		<h3 className="display-title mb-2 text-xs uppercase tracking-[0.2em] text-yellow-300/80">
			{children}
		</h3>
	);
}

function Row({
	label,
	value,
	tooltip,
}: {
	label: string;
	value: React.ReactNode;
	tooltip?: string;
}) {
	const row = (
		<div className="flex items-center justify-between gap-2 py-0.5 text-sm">
			<span
				className={tooltip ? "cursor-help text-white/60" : "text-white/60"}
			>
				{label}
			</span>
			<span className="text-right tabular-nums text-white">{value}</span>
		</div>
	);
	if (!tooltip) return row;
	// whitespace-pre-line so multi-line tooltip messages (e.g. attribute
	// breakdowns with one effect per line) render their newlines.
	return (
		<Tooltip content={<span className="whitespace-pre-line">{tooltip}</span>}>
			{row}
		</Tooltip>
	);
}

function AttributesSection({ stats }: { stats: ComputedCharacterStats }) {
	return (
		<section>
			<SectionHeading>{m.stats_section_attributes()}</SectionHeading>
			<Row
				label={m.attribute_strength()}
				value={stats.attributes.strength}
				tooltip={m.attribute_tooltip_strength({
					melee: STR_MELEE_PCT_PER_POINT,
					life: STR_LIFE_PER_POINT,
				})}
			/>
			<Row
				label={m.attribute_dexterity()}
				value={stats.attributes.dexterity}
				tooltip={m.attribute_tooltip_dexterity({
					accuracy: DEX_ACCURACY_PER_POINT,
					evasion: DEX_EVASION_PCT_PER_POINT,
				})}
			/>
			<Row
				label={m.attribute_intelligence()}
				value={stats.attributes.intelligence}
				tooltip={m.attribute_tooltip_intelligence({
					barrier: INT_BARRIER_PCT_PER_POINT,
				})}
			/>
		</section>
	);
}

function DefensesSection({
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
	// Rough heuristic for "typical enemy hit at this level" — calibrated
	// against monster baseline damage in act 1 (goblin: 2-4 phys at lvl 1,
	// scaling ~1.06^(L-1)). Used only as the reference hit for the panel's
	// armor mitigation preview; the gameplay formula reads the actual hit.
	const referenceHit = Math.max(5, referenceEnemyLevel * 5);
	const armor = computeArmorMitigation(stats.armor, referenceHit);
	const enemyAccuracyEstimate = referenceEnemyLevel * 10;
	const avoid = computeEvasionAvoid(stats.evasion, enemyAccuracyEstimate);
	return (
		<section>
			<SectionHeading>{m.stats_section_defenses()}</SectionHeading>
			<Row label={m.stats_life()} value={`${currentLife} / ${stats.maxLife}`} />
			{stats.maxBarrier > 0 && (
				<Row
					label={m.stats_barrier()}
					value={`${currentBarrier} / ${stats.maxBarrier}`}
				/>
			)}
			<Row
				label={m.stats_armor()}
				value={
					<span>
						{stats.armor}
						<span className="ml-2 text-xs text-white/40">
							({Math.round(armor.reductionPct)}%)
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
							({Math.round(avoid.avoidPct)}%)
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

function OffenseSection({ stats }: { stats: ComputedCharacterStats }) {
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

	// Compute a coarse DPS estimate by averaging per-swing damage and multiplying
	// by the combined tick rate. Doesn't account for crits/evasion/armor — just
	// a ballpark "if all hits land".
	const avgSwingDamage = (swing: SwingProfile) => {
		const physAvg = (swing.physicalDamage.min + swing.physicalDamage.max) / 2;
		const elemAvg = swing.elementalDamage.reduce(
			(sum, e) => sum + (e.min + e.max) / 2,
			0,
		);
		return physAvg + elemAvg;
	};
	const avgPerSwing =
		stats.swings.reduce((sum, s) => sum + avgSwingDamage(s), 0) /
		stats.swings.length;
	const dps = Math.round(avgPerSwing * stats.tickRate);

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

function UtilitySection({ stats }: { stats: ComputedCharacterStats }) {
	return (
		<section>
			<SectionHeading>{m.stats_section_utility()}</SectionHeading>
			<div className="grid grid-cols-2 gap-x-6">
				<Row
					label={m.stats_movement_speed()}
					value={`+${stats.movementSpeed}%`}
				/>
				<Row label={m.stats_life_on_hit()} value={stats.lifeGainOnHit} />
				<Row label={m.stats_mana_on_hit()} value={stats.manaGainOnHit} />
				<Row
					label={m.stats_life_leech()}
					value={`${stats.lifeLeechPercent}%`}
				/>
				<Row label={m.stats_life_on_kill()} value={stats.lifeOnKill} />
				<Row label={m.stats_mana_on_kill()} value={stats.manaOnKill} />
				<Row label={m.stats_magic_find()} value={`+${stats.magicFind}%`} />
			</div>
		</section>
	);
}
