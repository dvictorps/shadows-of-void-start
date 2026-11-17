import { fillPercent } from "../fill-percent";

export default function EnemyHpBar({
	current,
	max,
	currentBarrier,
	maxBarrier,
}: {
	current: number;
	max: number;
	currentBarrier: number;
	maxBarrier: number;
}) {
	const pct = fillPercent(current, max);
	const barrierPct = fillPercent(currentBarrier, maxBarrier);
	const showBarrier = maxBarrier > 0;
	return (
		<div className="mb-4 flex w-full max-w-sm flex-col items-center gap-1">
			{/* Mirrors HealthGlobe: blue barrier overlay drawn on top of the red
			 * HP fill in the same container so damage-hits-barrier-first reads
			 * visually as "blue width shrinks before red moves". */}
			<div className="relative h-3 w-full overflow-hidden rounded-full border border-white/40 bg-black">
				<div
					className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-700 to-red-500 transition-[width] duration-150"
					style={{ width: `${pct}%` }}
					aria-hidden
				/>
				{showBarrier && (
					<div
						className="absolute inset-y-0 left-0 bg-sky-400/70 transition-[width] duration-150"
						style={{
							width: `${barrierPct}%`,
							boxShadow: "inset 0 0 6px rgba(125, 211, 252, 0.55)",
						}}
						aria-hidden
					/>
				)}
			</div>
			<span className="text-xs uppercase tracking-wider text-white/60">
				{Math.ceil(current)} / {max}
				{showBarrier && (
					<span className="ml-2 text-sky-200/80">
						+ {Math.ceil(currentBarrier)} / {maxBarrier}
					</span>
				)}
			</span>
		</div>
	);
}
