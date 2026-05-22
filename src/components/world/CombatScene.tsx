import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { MonsterRarity } from "#/game/monsters";
import { translateMonsterName } from "#/game/world/i18n";
import type { BossIntroStage, DamageEvent, Enemy } from "#/hooks/useCombatLoop";
import { m } from "#/paraglide/messages";
import HealthGlobe from "./HealthGlobe";
import HitFx from "./HitFx";
import MonsterTooltip from "./MonsterTooltip";

// Rarity-tinted nameplate colors mirror the item rarity palette so the
// player reads "blue = magic, yellow = rare" consistently across UI.
const RARITY_NAMEPLATE_COLOR: Record<MonsterRarity, string> = {
	normal: "#ffffff",
	magic: "#8888ff",
	rare: "#ffff77",
};

export type ConsumableKey = "potion" | "teleport" | "wind_crystal";

type Props = {
	zoneName: string;
	zoneLevel: number;
	state:
		| "searching"
		| "boss_intro"
		| "engaged"
		| "victory"
		| "miniboss_victory";
	bossIntroStage: BossIntroStage;
	enemy: Enemy | null;
	events: DamageEvent[];
	playerHp: number;
	maxHp: number;
	barrier: number;
	maxBarrier: number;
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
	// Zone progression — kills accumulated in this visit and the threshold
	// at which the miniboss spawns. See CONTEXT.md → Threshold Bar.
	zoneKills: number;
	killsToThreshold: number;
	// Continue-farming choice on the post-miniboss modal.
	onDismissMinibossModal: () => void;
};

export default function CombatScene({
	zoneName,
	zoneLevel,
	state,
	bossIntroStage,
	enemy,
	events,
	playerHp,
	maxHp,
	barrier,
	maxBarrier,
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
	zoneKills,
	killsToThreshold,
	onDismissMinibossModal,
	onConsumableHover,
}: Props) {
	const xpPct = xpNeeded > 0 ? Math.min(100, (xp / xpNeeded) * 100) : 0;
	const thresholdPct = Math.min(100, (zoneKills / killsToThreshold) * 100);
	const enemyEvents = useMemo(
		() => events.filter((e) => e.target === "enemy"),
		[events],
	);
	const playerEvents = useMemo(
		() => events.filter((e) => e.target === "player"),
		[events],
	);
	// Latest event the player landed on the enemy with a weapon. Drives the
	// HitFx mount (renders even on block, per design — block animates the
	// visual but the enemy reaction below skips).
	const lastSwingHit = useMemo(() => {
		for (let i = enemyEvents.length - 1; i >= 0; i--) {
			const e = enemyEvents[i];
			if (e.weaponType && !e.isMiss) return e;
		}
		return null;
	}, [enemyEvents]);
	// Latest event that actually damaged the enemy. Drives the shake + flash.
	const lastDamagingHit = useMemo(() => {
		for (let i = enemyEvents.length - 1; i >= 0; i--) {
			const e = enemyEvents[i];
			if (!e.isMiss && !e.isBlocked) return e;
		}
		return null;
	}, [enemyEvents]);
	// Latest event where the player actually took damage. Drives the lighter
	// health-globe shake — miss/block don't trigger it.
	const lastPlayerHit = useMemo(() => {
		for (let i = playerEvents.length - 1; i >= 0; i--) {
			const e = playerEvents[i];
			if (!e.isMiss && !e.isBlocked) return e;
		}
		return null;
	}, [playerEvents]);
	const nameColor = enemy ? RARITY_NAMEPLATE_COLOR[enemy.rarity] : "#ffffff";

	// Staged reveal for rare minibosses. The nameplate appears at stage "name",
	// the HP bar at stage "hp". The sprite is always shown once the spawn
	// transitions out of "searching". For non-boss spawns (bossIntroStage is
	// null), everything appears together as before.
	const showNameplate =
		enemy !== null &&
		state !== "miniboss_victory" &&
		(state !== "boss_intro" || bossIntroStage !== "sprite");
	const showHpBar =
		enemy !== null &&
		state !== "miniboss_victory" &&
		(state !== "boss_intro" || bossIntroStage === "hp");

	// Sprite-level controls drive both the entrance animation and the in-combat
	// shake. Three effects mutate them, ordered by lifecycle: spawn entrance →
	// damage shake → victory fade. Mixing the entrance into framer-motion's
	// `initial` prop wouldn't survive same-monster respawns (key collision), so
	// the entrance is imperative: detect the null → non-null transition on
	// `enemy` and re-issue set+start every fresh spawn.
	const enemyControls = useAnimationControls();
	const prevEnemyRef = useRef<Enemy | null>(null);

	useLayoutEffect(() => {
		const wasNull = prevEnemyRef.current === null;
		prevEnemyRef.current = enemy;
		if (!enemy) return;
		if (!wasNull) return;
		const isRare = enemy.rarity === "rare";
		enemyControls.set({
			opacity: 0,
			scale: isRare ? 1.2 : 1,
			x: 0,
			filter: "brightness(1) saturate(1) hue-rotate(0deg)",
		});
		enemyControls.start({
			opacity: 1,
			scale: 1,
			transition: { duration: isRare ? 0.7 : 0.4, ease: "easeOut" },
		});
	}, [enemy, enemyControls]);

	useEffect(() => {
		if (!lastDamagingHit) return;
		const amp = lastDamagingHit.isCrit ? 6 : 4;
		enemyControls.start({
			x: [0, -amp, amp, -Math.round(amp * 0.7), Math.round(amp * 0.5), 0],
			filter: [
				"brightness(1) saturate(1) hue-rotate(0deg)",
				"brightness(1.8) saturate(2) hue-rotate(320deg)",
				"brightness(1) saturate(1) hue-rotate(0deg)",
			],
			transition: { duration: 0.2, times: [0, 0.2, 0.4, 0.6, 0.8, 1] },
		});
	}, [lastDamagingHit, enemyControls]);

	useEffect(() => {
		if (state !== "victory") return;
		enemyControls.start({ opacity: 0, transition: { duration: 0.5 } });
	}, [state, enemyControls]);

	return (
		<section className="relative flex flex-col overflow-hidden rounded-md border border-white/40 bg-black">
			{/* See CONTEXT.md → Threshold Bar. */}
			<div
				role="progressbar"
				aria-label="Zone threshold"
				aria-valuenow={zoneKills}
				aria-valuemin={0}
				aria-valuemax={killsToThreshold}
				className="h-1.5 w-full bg-white/10"
			>
				<div
					className="h-full bg-gradient-to-r from-red-500 via-orange-400 to-yellow-300 transition-[width] duration-300"
					style={{ width: `${thresholdPct}%` }}
				/>
			</div>
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

			{/* Enemy nameplate slot. Reserves a fixed height so the nameplate
			 * appearing during boss_intro (or any spawn) doesn't reflow the
			 * sprite below — only opacity / y animate. */}
			<div className="flex h-[120px] flex-col items-center gap-1 px-6 pt-14">
				{enemy && (
					<motion.div
						className="flex flex-col items-center gap-1"
						initial={false}
						animate={{
							opacity: showNameplate ? 1 : 0,
							y: showNameplate ? 0 : 8,
						}}
						transition={{ duration: 0.45, ease: "easeOut" }}
					>
						<div
							className="display-title text-4xl uppercase tracking-[0.15em]"
							style={{ color: nameColor }}
						>
							{translateMonsterName(enemy.def, enemy.mods)}
						</div>
						<div className="text-lg uppercase tracking-[0.2em] text-white/60">
							Lv {enemy.level}
						</div>
					</motion.div>
				)}
			</div>

			<div className="relative flex flex-1 flex-col items-center justify-center gap-4">
				<div className="relative flex flex-1 items-center justify-center">
					{state === "searching" && (
						<p className="animate-pulse text-xs uppercase tracking-[0.25em] text-white/40">
							{m.searching_enemy()}
						</p>
					)}
					{state === "miniboss_victory" && (
						<ZoneCompletePanel
							onContinue={onDismissMinibossModal}
							onRetreat={onRetreat}
						/>
					)}
					{enemy && state !== "searching" && state !== "miniboss_victory" && (
						<div className="group relative">
							<motion.img
								src={enemy.def.sprite}
								alt={translateMonsterName(enemy.def, enemy.mods)}
								draggable={false}
								className="pointer-events-none h-64 w-64 select-none object-contain"
								animate={enemyControls}
							/>
							<AnimatePresence>
								{lastSwingHit && (
									<HitFx
										key={lastSwingHit.id}
										weaponType={lastSwingHit.weaponType ?? "sword"}
										isCrit={lastSwingHit.isCrit}
									/>
								)}
							</AnimatePresence>
							{enemy.rarity !== "normal" && (
								<div className="-translate-x-1/2 pointer-events-none absolute top-full left-1/2 z-20 mt-2 hidden group-hover:block">
									<MonsterTooltip enemy={enemy} />
								</div>
							)}
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

				{/* HP bar slot. Always reserved when an enemy is present so the
				 * sprite above doesn't shift when the bar fades in during
				 * boss_intro stage 3. */}
				{enemy && state !== "miniboss_victory" && (
					<motion.div
						className="flex w-full justify-center"
						initial={false}
						animate={{ opacity: showHpBar ? 1 : 0, y: showHpBar ? 0 : -6 }}
						transition={{ duration: 0.45, ease: "easeOut" }}
					>
						<EnemyHpBar current={enemy.currentHp} max={enemy.scaled.hp} />
					</motion.div>
				)}
			</div>

			{/* Bottom HUD: HP globe + XP bar + teleport stone + (wind-crystal counter / potion) */}
			<div className="relative flex items-center gap-4 border-t border-white/15 bg-black/60 p-4">
				<div className="relative">
					<HealthGlobe
						hp={playerHp}
						maxHp={maxHp}
						barrier={barrier}
						maxBarrier={maxBarrier}
						size="xl"
						hitToken={lastPlayerHit?.id ?? null}
					/>
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

// Inline replacement for the post-miniboss modal. Renders in the central
// enemy area so the player stays in-scene to make the continue/retreat
// choice. See CONTEXT.md → Zone Miniboss.
function ZoneCompletePanel({
	onContinue,
	onRetreat,
}: {
	onContinue: () => void;
	onRetreat: () => void;
}) {
	return (
		<motion.div
			className="flex flex-col items-center gap-5 px-6"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ duration: 0.3 }}
		>
			<div
				className="display-title text-4xl uppercase tracking-[0.2em]"
				style={{
					color: "#ffd966",
					textShadow: "0 0 16px rgba(255, 217, 102, 0.45)",
				}}
			>
				{m.zone_complete_title()}
			</div>
			<p className="max-w-xs text-center text-sm text-white/70">
				{m.miniboss_modal_body()}
			</p>
			<div className="flex gap-3">
				<button
					type="button"
					onClick={onContinue}
					className="inline-flex items-center gap-2 border border-white/40 bg-black px-4 py-2 font-medium text-sm text-white/80 uppercase tracking-wider transition hover:border-white hover:bg-white/10 hover:text-white"
				>
					{m.miniboss_modal_continue()}
				</button>
				<button
					type="button"
					onClick={onRetreat}
					className="inline-flex items-center gap-2 border border-white/40 bg-black px-4 py-2 font-medium text-sm text-white/80 uppercase tracking-wider transition hover:border-white hover:bg-white/10 hover:text-white"
				>
					{m.miniboss_modal_retreat()}
				</button>
			</div>
		</motion.div>
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
			className="pointer-events-none select-none font-bold text-3xl text-yellow-300"
			style={{ textShadow: "0 2px 4px rgba(0,0,0,0.9)" }}
			initial={{ opacity: 1, y: 0 }}
			animate={{ opacity: 0, y: -70 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.8, ease: "easeOut" }}
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
