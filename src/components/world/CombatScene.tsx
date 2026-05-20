import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useMemo } from "react";
import type { DamageEvent, Enemy } from "#/hooks/useCombatLoop";
import { m } from "#/paraglide/messages";
import HealthGlobe from "./HealthGlobe";

export type ConsumableKey = "potion" | "teleport" | "wind_crystal";

type Props = {
	zoneName: string;
	zoneLevel: number;
	state: "searching" | "engaged" | "victory";
	enemy: Enemy | null;
	events: DamageEvent[];
	playerHp: number;
	maxHp: number;
	xp: number;
	xpNeeded: number;
	// XP from the most recent kill — fires a floating popup when state goes
	// engaged → victory. Persists across the victory frame so the popup has a
	// value to read.
	lastKillXp?: number;
	potions: number;
	canUsePotion: boolean;
	onUsePotion: () => void;
	teleportStones: number;
	windCrystals: number;
	canUseTeleportStone: boolean;
	onUseTeleportStone: () => void;
	onRetreat: () => void;
	bagCount: number;
	onOpenBag: () => void;
	// Hover bubbles back to the parent so the world's TextLog can describe the
	// consumable the player is pointing at. Null on mouse leave.
	onConsumableHover?: (key: ConsumableKey | null) => void;
};

export default function CombatScene({
	zoneName,
	zoneLevel,
	state,
	enemy,
	events,
	playerHp,
	maxHp,
	xp,
	xpNeeded,
	lastKillXp,
	potions,
	canUsePotion,
	onUsePotion,
	teleportStones,
	windCrystals,
	canUseTeleportStone,
	onUseTeleportStone,
	onRetreat,
	bagCount,
	onOpenBag,
	onConsumableHover,
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
			{/* Zone label + static zone level (the area's intrinsic difficulty;
			 * the per-spawn monster level is shown separately on the nameplate). */}
			<div className="absolute left-3 top-3 flex flex-col gap-0.5 text-xl uppercase tracking-[0.2em] text-white/60">
				<span>{zoneName}</span>
				<span className="text-base text-white/40">LV {zoneLevel}</span>
			</div>

			{/* Top-right action cluster: loot button then Retreat */}
			<div className="absolute top-3 right-3 z-10 flex items-center gap-2">
				<button
					type="button"
					onClick={onOpenBag}
					disabled={bagCount === 0}
					aria-label={`Loot bag (${bagCount} items)`}
					className="relative inline-flex items-center justify-center border border-white/40 bg-black p-2.5 text-white/80 transition hover:border-white hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-black"
				>
					<Sparkles className="h-5 w-5" strokeWidth={2} />
					{bagCount > 0 && (
						<span className="absolute -top-1.5 -right-1.5 min-w-[1.25rem] border border-white bg-black px-1 text-center font-bold text-xs text-white leading-tight">
							{bagCount}
						</span>
					)}
				</button>
				<button
					type="button"
					onClick={onRetreat}
					aria-label={m.retreat_to_map()}
					className="inline-flex items-center gap-2 border border-white/40 bg-black px-4 py-2.5 font-medium text-sm text-white/80 uppercase tracking-wider transition hover:border-white hover:bg-white/10 hover:text-white"
				>
					<ArrowLeft className="h-5 w-5" strokeWidth={2} />
					{m.retreat()}
				</button>
			</div>

			{/* Enemy nameplate: name on top, level directly below */}
			<div className="flex flex-col items-center gap-1 px-6 pt-14">
				{enemy ? (
					<>
						<div className="display-title text-4xl uppercase tracking-[0.15em] text-white">
							{enemy.def.name}
						</div>
						<div className="text-lg uppercase tracking-[0.2em] text-white/60">
							Lv {enemy.level}
						</div>
					</>
				) : (
					<div className="h-[40px]" />
				)}
			</div>

			{/* Enemy emoji area with HP bar pinned below the emoji */}
			<div className="relative flex flex-1 flex-col items-center justify-center gap-4">
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

					{/* Damage popups stacked over enemy */}
					<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
						<AnimatePresence>
							{enemyEvents.map((event) => (
								<FloatingDamage key={event.id} event={event} />
							))}
						</AnimatePresence>
					</div>

					{/* XP popup mounts on victory and unmounts on the next search,
					 * so AnimatePresence drives mount/exit instead of a manual queue. */}
					<div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
						<AnimatePresence>
							{state === "victory" && typeof lastKillXp === "number" && (
								<FloatingXp amount={lastKillXp} />
							)}
						</AnimatePresence>
					</div>
				</div>

				{enemy && (
					<EnemyHpBar current={enemy.currentHp} max={enemy.def.baseStats.hp} />
				)}
			</div>

			{/* Bottom HUD: HP globe + XP bar + teleport stone + (wind-crystal counter / potion) */}
			<div className="relative flex items-center gap-4 border-t border-white/15 bg-black/60 p-4">
				<div className="relative">
					<HealthGlobe hp={playerHp} maxHp={maxHp} size="md" />
					{/* Damage popups over the globe */}
					<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
						<AnimatePresence>
							{playerEvents.map((event) => (
								<FloatingDamage key={event.id} event={event} variant="player" />
							))}
						</AnimatePresence>
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

				{/* Teleport stone wears an invisible counter above so its base
				 * aligns with the potion (which carries the visible counter). */}
				<div className="flex flex-col items-center gap-1">
					<WindCrystalCounter count={windCrystals} hidden />
					<button
						type="button"
						onClick={onUseTeleportStone}
						onMouseEnter={() => onConsumableHover?.("teleport")}
						onMouseLeave={() => onConsumableHover?.(null)}
						onFocus={() => onConsumableHover?.("teleport")}
						onBlur={() => onConsumableHover?.(null)}
						disabled={!canUseTeleportStone}
						aria-label="Use teleport stone"
						className="relative flex h-20 w-20 shrink-0 items-center justify-center border border-white/40 bg-black transition hover:border-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-black"
					>
						<img
							src="/assets/sprites/ui/pedraTeleporte.png"
							alt=""
							draggable={false}
							className="pointer-events-none h-14 w-14 select-none object-contain"
						/>
						<span className="absolute -bottom-1.5 -right-1.5 min-w-[1.25rem] border border-white/40 bg-black px-1 text-center text-[10px] leading-tight text-white">
							{teleportStones}
						</span>
					</button>
				</div>

				{/* Wind-crystal usage is map-only; here the counter is just a readout. */}
				<div className="flex flex-col items-center gap-1">
					<WindCrystalCounter
						count={windCrystals}
						onHoverChange={(active) =>
							onConsumableHover?.(active ? "wind_crystal" : null)
						}
					/>
					<button
						type="button"
						onClick={onUsePotion}
						onMouseEnter={() => onConsumableHover?.("potion")}
						onMouseLeave={() => onConsumableHover?.(null)}
						onFocus={() => onConsumableHover?.("potion")}
						onBlur={() => onConsumableHover?.(null)}
						disabled={!canUsePotion}
						aria-label="Use potion"
						className="relative flex h-20 w-20 shrink-0 items-center justify-center border border-white/40 bg-black transition hover:border-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-black"
					>
						<img
							src="/assets/sprites/ui/pocaoCura.png"
							alt=""
							draggable={false}
							className="pointer-events-none h-14 w-14 select-none object-contain"
						/>
						<span className="absolute -bottom-1.5 -right-1.5 min-w-[1.25rem] border border-white/40 bg-black px-1 text-center text-[10px] leading-tight text-white">
							{potions}
						</span>
					</button>
				</div>
			</div>
		</section>
	);
}

// Rendered in both consumable columns so the teleport-stone button's baseline
// matches the potion's (which carries the visible counter). The `hidden`
// variant uses `invisible` rather than conditional rendering so the spacer
// always matches the real counter's height — no drift possible.
function WindCrystalCounter({
	count,
	hidden = false,
	onHoverChange,
}: {
	count: number;
	hidden?: boolean;
	onHoverChange?: (active: boolean) => void;
}) {
	return (
		<div
			role="img"
			aria-label={`${count} wind crystals`}
			aria-hidden={hidden || undefined}
			onMouseEnter={hidden ? undefined : () => onHoverChange?.(true)}
			onMouseLeave={hidden ? undefined : () => onHoverChange?.(false)}
			className={`display-title flex items-center gap-2 text-lg tracking-wider text-white ${hidden ? "invisible" : ""}`}
		>
			<img
				src="/assets/sprites/ui/cristalDeVento.png"
				alt=""
				draggable={false}
				aria-hidden="true"
				className="pointer-events-none h-10 w-10 select-none object-contain"
			/>
			<span className="tabular-nums">×{count}</span>
		</div>
	);
}

function FloatingXp({ amount }: { amount: number }) {
	return (
		<motion.span
			className="display-title pointer-events-none select-none font-bold text-2xl text-yellow-300 tracking-wider"
			style={{ textShadow: "0 2px 6px rgba(0,0,0,0.95)" }}
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: [0, 1, 1, 0], y: -30 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 1.4, ease: "easeOut", times: [0, 0.12, 0.7, 1] }}
		>
			+{amount} XP
		</motion.span>
	);
}

function EnemyHpBar({ current, max }: { current: number; max: number }) {
	const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
	return (
		<div className="mb-4 flex w-full max-w-sm flex-col items-center gap-1">
			<div className="h-3 w-full overflow-hidden rounded-full border border-white/40 bg-black">
				<div
					className="h-full bg-gradient-to-r from-red-700 to-red-500 transition-[width] duration-150"
					style={{ width: `${pct}%` }}
				/>
			</div>
			<span className="text-xs uppercase tracking-wider text-white/60">
				{Math.ceil(current)} / {max}
			</span>
		</div>
	);
}

// Lightweight deterministic hash from the event id so popups stay put across
// re-renders (otherwise Math.random() would jitter every frame).
function hashSeed(id: string): number {
	let h = 0;
	for (let i = 0; i < id.length; i++) {
		h = (h * 31 + id.charCodeAt(i)) | 0;
	}
	return (h >>> 0) / 0xffffffff;
}

function FloatingDamage({
	event,
	variant = "enemy",
}: {
	event: DamageEvent;
	variant?: "enemy" | "player";
}) {
	const seed = hashSeed(event.id);
	const isCrit = event.isCrit && !event.isMiss;
	const isBlocked = event.isBlocked && !event.isMiss;
	const isThorns = event.isThorns;
	const isLabel = event.isMiss || isBlocked;

	// Single direction angle biased upward for normal hits and crits alike —
	// the crit signal is the red color + "!!!" suffix, not a special arc.
	const angle = -Math.PI / 2 + (seed - 0.5) * 1.8;
	const distance = 70;
	const endX = Math.cos(angle) * distance;
	const endY = Math.sin(angle) * distance;
	const startOffset = 24;
	const startX = Math.cos(angle) * startOffset;
	const startY = Math.sin(angle) * startOffset;

	const color = event.isMiss
		? "text-white/60"
		: isBlocked
			? "text-blue-300"
			: isThorns
				? "text-purple-300"
				: isCrit
					? "text-red-500"
					: variant === "player"
						? "text-red-400"
						: "text-white";

	const display = event.isMiss
		? "MISS"
		: isBlocked
			? "BLOCK"
			: isCrit
				? `${event.amount}!!!`
				: `${event.amount}`;

	return (
		<motion.div
			className="pointer-events-none absolute select-none"
			style={{ textShadow: "0 2px 4px rgba(0,0,0,0.9)" }}
			initial={{ opacity: 1, x: startX, y: startY }}
			animate={{ opacity: 0, x: endX, y: endY }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.6, ease: "easeOut" }}
		>
			<span
				className={`block font-bold ${isLabel ? "text-xl uppercase tracking-wider" : "text-3xl"} ${color}`}
			>
				{display}
			</span>
		</motion.div>
	);
}
