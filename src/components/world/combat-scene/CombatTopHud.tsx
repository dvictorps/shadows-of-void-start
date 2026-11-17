import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Sparkles } from "lucide-react";

import { Button } from "#/components/ui/button";
import { m } from "#/paraglide/messages";

import { fillPercent } from "../fill-percent";

/**
 * The top of the scene: the zone time bar, the ambush banner, the zone label
 * and the loot / Retreat actions. Everything but the time bar fades out
 * while a camp's text plays.
 */
export default function CombatTopHud({
	zoneName,
	zoneLevel,
	calmariaElapsedMs,
	calmariaBudgetMs,
	campThresholdsMs,
	ambushActive,
	hudFading,
	bagCount,
	onOpenBag,
	onRetreat,
}: {
	zoneName: string;
	zoneLevel: number;
	calmariaElapsedMs: number;
	calmariaBudgetMs: number;
	campThresholdsMs: readonly number[];
	ambushActive: boolean;
	hudFading: boolean;
	bagCount: number;
	onOpenBag: () => void;
	onRetreat: () => void;
}) {
	return (
		<>
			<ZoneTimeBar
				elapsedMs={calmariaElapsedMs}
				budgetMs={calmariaBudgetMs}
				campThresholdsMs={campThresholdsMs}
			/>

			{/* Ambush cue — drops a centered banner while the pack is firing. See
			 * CONTEXT.md → Ambush events. */}
			<AnimatePresence>
				{ambushActive && (
					<motion.div
						key="ambush-banner"
						initial={{ opacity: 0, y: -8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
						transition={{ duration: 0.4 }}
						className="-translate-x-1/2 pointer-events-none absolute top-5 left-1/2 z-20 select-none"
						aria-live="polite"
					>
						<span
							className="display-title text-2xl uppercase tracking-[0.3em] text-red-400"
							style={{
								textShadow:
									"0 0 18px rgba(248, 113, 113, 0.7), 0 2px 6px rgba(0, 0, 0, 0.9)",
							}}
						>
							{m.ambush_banner()}
						</span>
					</motion.div>
				)}
			</AnimatePresence>
			{/* Zone label + static zone level (the area's intrinsic difficulty;
			 * the per-spawn monster level is shown separately on the nameplate). */}
			<div
				className={`absolute left-3 top-3 flex flex-col gap-0.5 text-xl uppercase tracking-[0.2em] text-white/60 transition-opacity duration-[1200ms] ease-out ${
					hudFading ? "opacity-0" : "opacity-100"
				}`}
			>
				<span>{zoneName}</span>
				<span className="text-base text-white/40">LV {zoneLevel}</span>
			</div>

			{/* Top-right action cluster: loot button then Retreat */}
			<div
				className={`absolute top-3 right-3 z-10 flex items-center gap-2 transition-opacity duration-[1200ms] ease-out ${
					hudFading ? "pointer-events-none opacity-0" : "opacity-100"
				}`}
			>
				<Button
					variant="hud"
					size="hud-icon"
					onClick={onOpenBag}
					disabled={bagCount === 0}
					aria-label={`Loot bag (${bagCount} items)`}
					className="relative"
				>
					<Sparkles strokeWidth={2} />
					{bagCount > 0 && (
						<span className="absolute -top-1.5 -right-1.5 min-w-[1.25rem] border border-white bg-black px-1 text-center font-bold text-xs text-white leading-tight">
							{bagCount}
						</span>
					)}
				</Button>
				<Button
					variant="hud"
					size="hud-lg"
					caps
					onClick={onRetreat}
					aria-label={m.retreat_to_map()}
				>
					<ArrowLeft strokeWidth={2} />
					{m.retreat()}
				</Button>
			</div>
		</>
	);
}

// See CONTEXT.md → Time Bar. The bar itself stays full-opacity even during a
// camp — players need to see where they paused.
function ZoneTimeBar({
	elapsedMs,
	budgetMs,
	campThresholdsMs,
}: {
	elapsedMs: number;
	budgetMs: number;
	campThresholdsMs: readonly number[];
}) {
	return (
		<div
			role="progressbar"
			aria-label="Zone time progress"
			aria-valuenow={Math.round(elapsedMs)}
			aria-valuemin={0}
			aria-valuemax={budgetMs}
			className="relative h-2 w-full bg-white/10"
		>
			<div
				className="h-full bg-gradient-to-r from-red-500 via-orange-400 to-yellow-300 transition-[width] duration-100 ease-linear"
				style={{ width: `${fillPercent(elapsedMs, budgetMs)}%` }}
			/>
			{campThresholdsMs.map((thresholdMs) => (
				<span
					key={thresholdMs}
					aria-hidden
					className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute top-1/2 h-3 w-1 bg-amber-200 shadow-[0_0_6px_rgba(252,211,77,0.85)]"
					style={{ left: `${fillPercent(thresholdMs, budgetMs)}%` }}
				/>
			))}
		</div>
	);
}
