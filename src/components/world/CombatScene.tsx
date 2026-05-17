import { ArrowLeft, Sparkles } from "lucide-react";
import { useMemo } from "react";
import type { DamageEvent, Enemy } from "#/hooks/useCombatLoop";
import { m } from "#/paraglide/messages";
import HealthGlobe from "./HealthGlobe";

type Props = {
	zoneName: string;
	state: "searching" | "engaged" | "victory";
	enemy: Enemy | null;
	events: DamageEvent[];
	lastXpGain: number | null;
	playerHp: number;
	maxHp: number;
	xp: number;
	xpNeeded: number;
	potions: number;
	canUsePotion: boolean;
	onUsePotion: () => void;
	onRetreat: () => void;
	bagCount: number;
	onOpenBag: () => void;
};

export default function CombatScene({
	zoneName,
	state,
	enemy,
	events,
	lastXpGain,
	playerHp,
	maxHp,
	xp,
	xpNeeded,
	potions,
	canUsePotion,
	onUsePotion,
	onRetreat,
	bagCount,
	onOpenBag,
}: Props) {
	const xpPct = xpNeeded > 0 ? Math.min(100, (xp / xpNeeded) * 100) : 0;
	const enemyEvents = useMemo(
		() => events.filter((e) => e.target === "enemy"),
		[events],
	);
	const playerEvents = useMemo(
		() => events.filter((e) => e.target === "player"),
		[events],
	);

	return (
		<section className="relative flex flex-col overflow-hidden rounded-md border border-white/40 bg-black">
			{/* Zone label */}
			<div className="absolute left-3 top-3 text-[10px] uppercase tracking-[0.2em] text-white/40">
				{zoneName}
			</div>

			{/* Top-right action cluster: loot button then Retreat */}
			<div className="absolute top-3 right-3 z-10 flex items-center gap-2">
				<button
					type="button"
					onClick={onOpenBag}
					disabled={bagCount === 0}
					aria-label={`Loot bag (${bagCount} items)`}
					className="relative inline-flex items-center justify-center border border-white/40 bg-black p-1.5 text-white/80 transition hover:border-white hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-black"
				>
					<Sparkles className="h-4 w-4" strokeWidth={2} />
					{bagCount > 0 && (
						<span className="absolute -top-1.5 -right-1.5 min-w-[1.1rem] border border-white bg-black px-1 text-center font-bold text-[10px] text-white leading-tight">
							{bagCount}
						</span>
					)}
				</button>
				<button
					type="button"
					onClick={onRetreat}
					aria-label={m.retreat_to_map()}
					className="inline-flex items-center gap-1.5 border border-white/40 bg-black px-3 py-1.5 font-medium text-[10px] text-white/80 uppercase tracking-wider transition hover:border-white hover:bg-white/10 hover:text-white"
				>
					<ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
					{m.retreat()}
				</button>
			</div>

			{/* Enemy nameplate + HP bar */}
			<div className="flex flex-col items-center gap-2 px-6 pt-12">
				{enemy ? (
					<>
						<div className="display-title text-lg uppercase tracking-[0.15em] text-white">
							{enemy.def.name}
						</div>
						<EnemyHpBar
							current={enemy.currentHp}
							max={enemy.def.baseStats.hp}
						/>
					</>
				) : (
					<div className="h-[40px]" />
				)}
			</div>

			{/* Enemy emoji area */}
			<div className="relative flex flex-1 items-center justify-center">
				{state === "searching" && (
					<p className="animate-pulse text-xs uppercase tracking-[0.25em] text-white/40">
						{m.searching_enemy()}
					</p>
				)}
				{enemy && state !== "searching" && (
					<div
						key={enemy.def.id}
						className={`text-7xl transition-opacity duration-500 ${
							state === "victory" ? "opacity-0" : "opacity-100"
						}`}
						style={{ animation: "fadeIn 400ms ease-out" }}
					>
						{enemy.def.emoji}
					</div>
				)}
				{state === "victory" && lastXpGain !== null && (
					<div
						className="absolute text-base uppercase tracking-[0.2em] text-yellow-300"
						style={{ animation: "xp-rise 800ms ease-out" }}
					>
						+{lastXpGain} XP
					</div>
				)}

				{/* Damage popups stacked over enemy */}
				<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
					{enemyEvents.map((event) => (
						<FloatingDamage key={event.id} event={event} />
					))}
				</div>
			</div>

			{/* Bottom HUD: HP globe + XP bar + potion button */}
			<div className="relative flex items-center gap-4 border-t border-white/15 bg-black/60 p-4">
				<div className="relative">
					<HealthGlobe hp={playerHp} maxHp={maxHp} size="lg" />
					{/* Damage popups over the globe */}
					<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
						{playerEvents.map((event) => (
							<FloatingDamage key={event.id} event={event} variant="player" />
						))}
					</div>
				</div>

				<div className="flex-1 space-y-1">
					<div className="text-[10px] uppercase tracking-wider text-yellow-300/80">
						XP: {xp} / {xpNeeded}
					</div>
					<div
						role="progressbar"
						aria-label="Experience"
						aria-valuenow={xp}
						aria-valuemin={0}
						aria-valuemax={xpNeeded}
						className="h-3 w-full overflow-hidden rounded-full bg-white/10"
					>
						<div
							className="h-full bg-yellow-300 transition-[width] duration-200"
							style={{ width: `${xpPct}%` }}
						/>
					</div>
				</div>

				<button
					type="button"
					onClick={onUsePotion}
					disabled={!canUsePotion}
					aria-label="Use potion"
					className="relative flex h-14 w-14 shrink-0 items-center justify-center border border-white/40 bg-black text-2xl transition hover:border-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-black"
				>
					🧪
					<span className="absolute -bottom-1.5 -right-1.5 min-w-[1.25rem] border border-white/40 bg-black px-1 text-center text-[10px] leading-tight text-white">
						{potions}
					</span>
				</button>
			</div>
		</section>
	);
}

function EnemyHpBar({ current, max }: { current: number; max: number }) {
	const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
	return (
		<div className="flex w-full max-w-xs flex-col items-center gap-1">
			<div className="h-2.5 w-full overflow-hidden rounded-full border border-white/40 bg-black">
				<div
					className="h-full bg-gradient-to-r from-red-700 to-red-500 transition-[width] duration-150"
					style={{ width: `${pct}%` }}
				/>
			</div>
			<span className="text-[10px] uppercase tracking-wider text-white/50">
				{Math.ceil(current)} / {max}
			</span>
		</div>
	);
}

function FloatingDamage({
	event,
	variant = "enemy",
}: {
	event: DamageEvent;
	variant?: "enemy" | "player";
}) {
	const color = event.isCrit
		? "text-yellow-300"
		: variant === "player"
			? "text-red-400"
			: "text-white";
	return (
		<span
			className={`pointer-events-none absolute select-none text-3xl font-bold ${color}`}
			style={{
				animation: "damage-float 900ms ease-out forwards",
				textShadow: "0 2px 4px rgba(0,0,0,0.9)",
			}}
		>
			{event.amount}
			{event.isCrit && "!"}
		</span>
	);
}
