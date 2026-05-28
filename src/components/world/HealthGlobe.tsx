import { motion, useAnimationControls } from "framer-motion";
import { useEffect } from "react";
import { BARRIER_REFILL_DELAY_SECONDS } from "#/game/combat/constants";

type Props = {
	hp: number;
	maxHp: number;
	/** Current barrier. Renders the blue overlay; omit / 0 hides it. */
	barrier?: number;
	maxBarrier?: number;
	/**
	 * Seconds remaining on the post-break refill cooldown. When > 0, a sky
	 * ring sweeps around the globe — empty at break, full at snap. Driven
	 * by the BarrierState's `refillRemaining` field.
	 */
	barrierRefillRemaining?: number;
	size?: "sm" | "md" | "lg" | "xl";
	/**
	 * Opaque token that changes whenever the player takes damage. The globe
	 * shakes briefly on each new value. Lighter than the enemy's reaction
	 * (amp ~2 vs 4-6) so the player's own UI doesn't yank during combat.
	 */
	hitToken?: string | number | null;
};

const SIZE_CLASSES: Record<NonNullable<Props["size"]>, string> = {
	sm: "h-16 w-16 text-[10px]",
	md: "h-24 w-24 text-sm",
	lg: "h-28 w-28 text-sm",
	xl: "h-36 w-36 text-base",
};

export default function HealthGlobe({
	hp,
	maxHp,
	barrier = 0,
	maxBarrier = 0,
	barrierRefillRemaining = 0,
	size = "sm",
	hitToken = null,
}: Props) {
	const dimensions = SIZE_CLASSES[size];
	const hpPct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
	const barrierPct =
		maxBarrier > 0
			? Math.max(0, Math.min(100, (barrier / maxBarrier) * 100))
			: 0;
	const showBarrier = maxBarrier > 0;
	const showRefill = maxBarrier > 0 && barrierRefillRemaining > 0;
	const refillProgress = showRefill
		? Math.max(
				0,
				Math.min(
					1,
					1 - barrierRefillRemaining / BARRIER_REFILL_DELAY_SECONDS,
				),
			)
		: 0;

	const controls = useAnimationControls();
	useEffect(() => {
		if (hitToken === null) return;
		controls.start({
			x: [0, -2, 2, -1.5, 1, 0],
			transition: { duration: 0.18, times: [0, 0.2, 0.4, 0.6, 0.8, 1] },
		});
	}, [hitToken, controls]);

	return (
		<motion.div
			role="img"
			aria-label="Health and barrier"
			animate={controls}
			className={`relative flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-full border-2 border-red-900/70 bg-black text-center shadow-[inset_0_-10px_18px_rgba(0,0,0,0.45),0_0_18px_rgba(220,38,38,0.4)] ${dimensions}`}
		>
			{/* Red HP fill — rises from the bottom in proportion to current HP */}
			<div
				className="absolute inset-x-0 bottom-0 bg-red-600 transition-[height] duration-100"
				style={{ height: `${hpPct}%` }}
				aria-hidden
			/>

			{/* Blue barrier fill — drawn over the red, descends as barrier is
			 * lost. Damage hits the barrier first, so visually it shrinks before
			 * the red layer ever moves. */}
			{showBarrier && (
				<div
					className="absolute inset-x-0 bottom-0 bg-sky-400/60 transition-[height] duration-100"
					style={{
						height: `${barrierPct}%`,
						boxShadow: "inset 0 0 14px rgba(125, 211, 252, 0.55)",
					}}
					aria-hidden
				/>
			)}

			{/* Refill cooldown ring — empty at break, full at snap. -rotate-90 starts it at 12 o'clock. */}
			{showRefill && (
				<svg
					className="-rotate-90 pointer-events-none absolute inset-0 h-full w-full"
					viewBox="0 0 100 100"
					aria-hidden
				>
					<circle
						cx="50"
						cy="50"
						r="48"
						fill="none"
						stroke="#7dd3fc"
						strokeWidth="3"
						strokeLinecap="round"
						pathLength={100}
						strokeDasharray={`${refillProgress * 100} 100`}
						style={{
							filter: "drop-shadow(0 0 4px rgba(125, 211, 252, 0.85))",
							transition: "stroke-dasharray 100ms linear",
						}}
					/>
				</svg>
			)}

			<span className="relative z-10 font-bold leading-tight text-white">
				{Math.ceil(hp)}/{maxHp}
			</span>
			{showBarrier && (
				<span className="relative z-10 text-[0.85em] leading-tight text-sky-100/90">
					{Math.ceil(barrier)}/{maxBarrier}
				</span>
			)}
		</motion.div>
	);
}
