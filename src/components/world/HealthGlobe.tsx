type Props = {
	hp: number;
	maxHp: number;
	barrier?: number;
	size?: "sm" | "lg";
};

export default function HealthGlobe({
	hp,
	maxHp,
	barrier = 0,
	size = "sm",
}: Props) {
	const dimensions =
		size === "lg" ? "h-28 w-28 text-sm" : "h-16 w-16 text-[10px]";
	const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;

	return (
		<div
			role="img"
			aria-label="Health and barrier"
			className={`relative flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-full border-2 border-red-900/70 bg-black text-center shadow-[inset_0_-10px_18px_rgba(0,0,0,0.45),0_0_18px_rgba(220,38,38,0.4)] ${dimensions}`}
		>
			{/* Liquid fill — rises from the bottom in proportion to current HP */}
			<div
				className="absolute inset-x-0 bottom-0 bg-red-600 transition-[height] duration-200"
				style={{ height: `${pct}%` }}
				aria-hidden
			/>

			<span className="relative z-10 font-bold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
				{Math.ceil(hp)}/{maxHp}
			</span>
			{barrier > 0 && (
				<span className="relative z-10 text-[0.85em] leading-tight text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
					{barrier}/{barrier}
				</span>
			)}
		</div>
	);
}
