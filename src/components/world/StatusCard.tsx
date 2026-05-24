import { Button } from "#/components/ui/button";
import Tooltip from "#/components/ui/tooltip";
import { getClassDisplayName } from "#/game/classes/i18n";
import { xpToNextLevel } from "#/game/progression/levels";
import {
	DEX_ACCURACY_PER_POINT,
	DEX_EVASION_PCT_PER_POINT,
	INT_BARRIER_PCT_PER_POINT,
	STR_LIFE_PER_POINT,
	STR_MELEE_PCT_PER_POINT,
} from "#/game/stats/compute";
import type { ComputedCharacterStats } from "#/game/stats/types";
import { m } from "#/paraglide/messages";
import type { Doc } from "../../../convex/_generated/dataModel";
import HealthGlobe from "./HealthGlobe";

type Props = {
	character: Doc<"characters">;
	stats: ComputedCharacterStats;
	hpOverride?: number;
	barrierOverride?: number;
	potionsOverride?: number;
	teleportStones: number;
	onUsePotion?: () => void;
	onUseTeleportStone?: () => void;
	onShowStats?: () => void;
};

function attributeReadouts(stats: ComputedCharacterStats) {
	return [
		{
			label: m.status_strength_label(),
			value: stats.attributes.strength,
			glow: "text-glow-red",
			tooltip: m.attribute_tooltip_strength({
				melee: STR_MELEE_PCT_PER_POINT,
				life: STR_LIFE_PER_POINT,
			}),
		},
		{
			label: m.status_dexterity_label(),
			value: stats.attributes.dexterity,
			glow: "text-glow-green",
			tooltip: m.attribute_tooltip_dexterity({
				accuracy: DEX_ACCURACY_PER_POINT,
				evasion: DEX_EVASION_PCT_PER_POINT,
			}),
		},
		{
			label: m.status_intelligence_label(),
			value: stats.attributes.intelligence,
			glow: "text-glow-blue",
			tooltip: m.attribute_tooltip_intelligence({
				barrier: INT_BARRIER_PCT_PER_POINT,
			}),
		},
	];
}

function estimateDps(stats: ComputedCharacterStats): number {
	if (stats.swings.length === 0) return 0;
	const avgPerSwing =
		stats.swings.reduce((sum, s) => {
			const phys = (s.physicalDamage.min + s.physicalDamage.max) / 2;
			const elem = s.elementalDamage.reduce(
				(t, e) => t + (e.min + e.max) / 2,
				0,
			);
			return sum + phys + elem;
		}, 0) / stats.swings.length;
	return Math.round(avgPerSwing * stats.tickRate);
}

export default function StatusCard({
	character,
	stats,
	hpOverride,
	barrierOverride,
	potionsOverride,
	teleportStones,
	onShowStats,
	onUsePotion,
	onUseTeleportStone,
}: Props) {
	const classResolved = getClassDisplayName(character.classId);
	const maxHp = stats.maxLife;
	const hpServer = character.hpCurrent ?? maxHp;
	const hp = hpOverride ?? hpServer;
	const potions = potionsOverride ?? character.potions ?? 0;
	const xp = character.xp ?? 0;
	const xpNeeded = xpToNextLevel(character.level);
	const xpPct = Math.min(100, (xp / xpNeeded) * 100);
	const maxBarrier = stats.maxBarrier;
	// Outside combat the barrier always shows full; mid-combat the live value
	// from the combat hook overrides it.
	const barrier = barrierOverride ?? maxBarrier;
	const canUsePotion = !!onUsePotion && potions > 0 && hp < maxHp;
	// Clicking from the city would consume a stone for a no-op, so disable.
	const canUseTeleportStone =
		!!onUseTeleportStone &&
		teleportStones > 0 &&
		character.currentLocation !== "city";
	const dps = estimateDps(stats);

	return (
		<section className="rounded-md border border-white/40 p-4">
			<div className="flex flex-col gap-3">
				<div className="grid grid-cols-2 gap-4">
					<div className="min-w-0">
						<h3 className="display-title truncate text-2xl uppercase tracking-wider text-white">
							{character.name}
						</h3>
						<p className="mt-1 text-lg text-white/80">
							<span className="text-white/50">{m.status_class_label()}</span>{" "}
							{classResolved}
						</p>
						<p className="text-lg text-white/80">
							<span className="text-white/50">{m.status_level_label()}</span>{" "}
							{character.level}
						</p>
						<p className="text-lg text-white/80">
							<span className="text-white/50">{m.status_dps_label()}</span>{" "}
							{dps > 0 ? dps : "—"}
						</p>
					</div>
					<div className="display-title space-y-1.5 text-right text-xl tracking-wider">
						{attributeReadouts(stats).map((row) => (
							<Tooltip
								key={row.label}
								content={<span className="whitespace-pre-line">{row.tooltip}</span>}
							>
								<p className={row.glow}>
									{row.label} {row.value}
								</p>
							</Tooltip>
						))}
					</div>
				</div>

				<div className="flex items-center gap-3">
					<div className="flex-1 space-y-1">
						<div className="text-sm uppercase tracking-wider text-yellow-300/80">
							{m.status_xp_label({ current: xp, needed: xpNeeded })}
						</div>
						<div
							role="progressbar"
							aria-label="Experience"
							aria-valuenow={xp}
							aria-valuemin={0}
							aria-valuemax={xpNeeded}
							className="h-2 w-full overflow-hidden rounded-full bg-white/10"
						>
							<div
								className="h-full bg-yellow-300 transition-[width] duration-200"
								style={{ width: `${xpPct}%` }}
							/>
						</div>
					</div>
					<Tooltip content={m.consumable_desc_potion()}>
						<button
							type="button"
							onClick={onUsePotion}
							disabled={!canUsePotion}
							aria-label="Use potion"
							className="relative flex h-16 w-16 shrink-0 items-center justify-center border border-white/40 bg-black transition hover:border-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-black"
						>
							<img
								src="/assets/sprites/ui/pocaoCura.png"
								alt=""
								draggable={false}
								className="pointer-events-none h-12 w-12 select-none object-contain"
							/>
							<span className="absolute -bottom-1.5 -right-1.5 min-w-[1.25rem] border border-white/40 bg-black px-1 text-center text-xs leading-tight text-white">
								{potions}
							</span>
						</button>
					</Tooltip>
				</div>

				<hr className="border-white/15" />

				<div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
					<div className="flex flex-col items-center gap-1">
						<span className="text-[10px] uppercase tracking-wider text-white/50">
							{m.status_header()}
						</span>
						<Button
							type="button"
							variant="stark"
							onClick={onShowStats}
							disabled={!onShowStats}
							className="px-3 py-1.5 text-xs uppercase tracking-wider"
						>
							{m.show_action()}
						</Button>
					</div>

					<div className="flex justify-center gap-2">
						<Tooltip content={m.consumable_desc_teleport()}>
							<button
								type="button"
								onClick={onUseTeleportStone}
								disabled={!canUseTeleportStone}
								aria-label="Use teleport stone"
								className="relative flex h-16 w-16 items-center justify-center border border-white/30 bg-black/60 transition hover:border-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-white/30 disabled:hover:bg-black/60"
							>
								<img
									src="/assets/sprites/ui/pedraTeleporte.png"
									alt=""
									draggable={false}
									className="pointer-events-none h-12 w-12 select-none object-contain"
								/>
								<span className="absolute -bottom-1.5 -right-1.5 min-w-[1.25rem] border border-white/40 bg-black px-1 text-center text-xs leading-tight text-white">
									{teleportStones}
								</span>
							</button>
						</Tooltip>
					</div>

					<HealthGlobe
						hp={hp}
						maxHp={maxHp}
						barrier={barrier}
						maxBarrier={maxBarrier}
					/>
				</div>
			</div>
		</section>
	);
}
