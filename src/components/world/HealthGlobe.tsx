import { motion, useAnimationControls } from "framer-motion";
import { useEffect } from "react";

type Props = {
	hp: number;
	maxHp: number;
	/** Current barrier. Renders the blue overlay; omit / 0 hides it. */
	barrier?: number;
	maxBarrier?: number;
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
				className="absolute inset-x-0 bottom-0 bg-red-600 transition-[height] duration-200"
				style={{ height: `${hpPct}%` }}
				aria-hidden
			/>

			{/* Blue barrier fill — drawn over the red, descends as barrier is
			 * lost. Damage hits the barrier first, so visually it shrinks before
			 * the red layer ever moves. */}
			{showBarrier && (
				<div
					className="absolute inset-x-0 bottom-0 bg-sky-400/60 transition-[height] duration-200"
					style={{
						height: `${barrierPct}%`,
						boxShadow: "inset 0 0 14px rgba(125, 211, 252, 0.55)",
					}}
					aria-hidden
				/>
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
