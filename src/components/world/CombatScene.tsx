import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { ArrowLeft, Sparkles } from "lucide-react";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { getBossConfig } from "#/game/bosses";
import type { MonsterRarity } from "#/game/monsters";
import { translateEnemyName } from "#/game/world/i18n";
import type {
	BossIntroStage,
	CampSource,
	DamageEvent,
	Enemy,
	RareIntroStage,
} from "#/hooks/useCombatLoop";
import { playSfx } from "#/lib/sfx";
import { m } from "#/paraglide/messages";
import CampCinematic from "./CampCinematic";
import ElementSelector from "./ElementSelector";
import HealthGlobe from "./HealthGlobe";
import HitFx from "./HitFx";
import MonsterTooltip from "./MonsterTooltip";

// Rarity-tinted nameplate colors mirror the item rarity palette so the
// player reads "blue = magic, yellow = rare" consistently across UI. The
// `unique` entry is a fallback — bosses override per-instance via
// BossConfig.nameplateColor.
const RARITY_NAMEPLATE_COLOR: Record<MonsterRarity, string> = {
	normal: "#ffffff",
	magic: "#8888ff",
	rare: "#ffff77",
	unique: "#af6025",
};

// Glow reinforces rarity. Normal keeps only a readability shadow; magic/rare
// add a color-matched halo. Rare's halo is stronger to preserve its drama
// even though it shares the staging spotlight with the boss intro cascade.
const RARITY_NAMEPLATE_SHADOW: Record<MonsterRarity, string> = {
	normal: "0 2px 4px rgba(0, 0, 0, 0.9)",
	magic: "0 0 14px rgba(136, 136, 255, 0.75), 0 2px 4px rgba(0, 0, 0, 0.9)",
	rare: "0 0 18px rgba(255, 255, 119, 0.7), 0 2px 4px rgba(0, 0, 0, 0.9)",
	unique: "0 0 22px rgba(175, 96, 37, 0.75), 0 2px 4px rgba(0, 0, 0, 0.9)",
};

export type ConsumableKey =
	| "potion"
	| "teleport"
	| "incense"
	| "element_fire"
	| "element_cold"
	| "element_lightning";

type Props = {
	zoneName: string;
	zoneLevel: number;
	state:
		| "searching"
		| "rare_intro"
		| "boss_intro"
		| "engaged"
		| "victory"
		| "miniboss_victory"
		| "acampamento";
	isBossNode: boolean;
	rareIntroStage: RareIntroStage;
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
	canUseTeleportStone: boolean;
	onUseTeleportStone: () => void;
	incense: number;
	canUseIncense: boolean;
	onUseIncense: () => void;
	// Active camp source — drives flavor text + (future) ambient audio in the
	// cinematic. See CONTEXT.md → Incenso Etéreo.
	campSource: CampSource;
	// True while an ambush pack is firing — drives the "Ambush!" banner. See
	// CONTEXT.md → Ambush events.
	ambushActive: boolean;
	onRetreat: () => void;
	bagCount: number;
	onOpenBag: () => void;
	// Hover bubbles back to the parent so the world's TextLog can describe the
	// consumable the player is pointing at. Null on mouse leave.
	onConsumableHover?: (key: ConsumableKey | null) => void;
	// Zone progression — cumulative calmaria (out-of-combat) ms vs. the zone's
	// time budget. Bar fills smoothly during searching, pauses in combat.
	// `campThresholdsMs` carries the actual rolled positions for the run so
	// the bar can render markers where each camp will fire.
	// See CONTEXT.md → Time Bar / Acampamento.
	calmariaElapsedMs: number;
	calmariaBudgetMs: number;
	campThresholdsMs: readonly number[];
	// Continue-farming choice on the post-miniboss modal.
	onDismissMinibossModal: () => void;
	// Acampamento overlay — fired by the combat loop when the calmaria timer
	// crosses a zone's camp threshold. See CONTEXT.md → Acampamento.
	zoneId: string;
	onDismissCamp: () => void;
	classId?: string;
	selectedElement?: "fire" | "cold" | "lightning";
	onSwitchElement?: (element: "fire" | "cold" | "lightning") => void;
	lastElementSwitchAt?: number;
};

export default function CombatScene({
	zoneName,
	zoneLevel,
	state,
	isBossNode,
	rareIntroStage,
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
	canUseTeleportStone,
	onUseTeleportStone,
	incense,
	canUseIncense,
	onUseIncense,
	campSource,
	ambushActive,
	onRetreat,
	bagCount,
	onOpenBag,
	calmariaElapsedMs,
	calmariaBudgetMs,
	campThresholdsMs,
	onDismissMinibossModal,
	zoneId,
	onDismissCamp,
	onConsumableHover,
	classId,
	selectedElement,
	onSwitchElement,
	lastElementSwitchAt,
}: Props) {
	const xpPct = xpNeeded > 0 ? Math.min(100, (xp / xpNeeded) * 100) : 0;
	const thresholdPct =
		calmariaBudgetMs > 0
			? Math.min(100, (calmariaElapsedMs / calmariaBudgetMs) * 100)
			: 0;
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
	// Bosses get a per-instance nameplate color from BossConfig (rare yellow
	// shouldn't double-duty as the boss color, and each boss can pick a hue
	// that matches its theme — Gralfor: ember orange).
	const bossConfig = useMemo(
		() => (enemy ? getBossConfig(enemy) : null),
		[enemy?.rarity, enemy?.def.id],
	);
	const nameColor = bossConfig
		? bossConfig.nameplateColor
		: enemy
			? RARITY_NAMEPLATE_COLOR[enemy.rarity]
			: "#ffffff";
	const nameShadow = bossConfig
		? bossConfig.nameplateShadow
		: enemy
			? RARITY_NAMEPLATE_SHADOW[enemy.rarity]
			: RARITY_NAMEPLATE_SHADOW.normal;
	const isStagedEnemy = enemy?.rarity === "rare" || enemy?.rarity === "unique";
	const nameplateDelay = isStagedEnemy ? 0 : 0.08;
	const hpBarDelay = isStagedEnemy ? 0 : 0.16;

	// Staged reveal for rare minibosses (3 beats) and bosses (4 beats — adds
	// an "impact" beat between sprite and name for sfx + screenshake). The
	// sprite is always shown once the spawn transitions out of "searching".
	// On victory, both fade out alongside the sprite so the exit mirrors the
	// entrance instead of the nameplate/bar popping out when the enemy unmounts.
	const showNameplate =
		enemy !== null &&
		state !== "miniboss_victory" &&
		state !== "victory" &&
		(state !== "rare_intro" || rareIntroStage !== "sprite") &&
		(state !== "boss_intro" ||
			(bossIntroStage !== "sprite" && bossIntroStage !== "impact"));
	const showHpBar =
		enemy !== null &&
		state !== "miniboss_victory" &&
		state !== "victory" &&
		(state !== "rare_intro" || rareIntroStage === "hp") &&
		(state !== "boss_intro" || bossIntroStage === "hp");
	// Read once per render — both the nameplate text and the img alt need it.
	const enemyDisplayName = enemy ? translateEnemyName(enemy) : "";

	// Sprite-level controls drive both the entrance animation and the in-combat
	// shake. Three effects mutate them, ordered by lifecycle: spawn entrance →
	// damage shake → victory fade. Mixing the entrance into framer-motion's
	// `initial` prop wouldn't survive same-monster respawns (key collision), so
	// the entrance is imperative: detect the null → non-null transition on
	// `enemy` and re-issue set+start every fresh spawn.
	const enemyControls = useAnimationControls();
	// Separate controls for the red hit-flash overlay (the sprite shape
	// repainted solid red via CSS mask). Filter-based recolors couldn't push
	// every pixel to pure red on dark/colorful sprites — masking does.
	const redFlashControls = useAnimationControls();
	const prevEnemyRef = useRef<Enemy | null>(null);

	useLayoutEffect(() => {
		const wasNull = prevEnemyRef.current === null;
		prevEnemyRef.current = enemy;
		if (!enemy) return;
		if (!wasNull) return;
		enemyControls.set({
			opacity: 0,
			scale: isStagedEnemy ? 1.2 : 1,
			x: 0,
			y: isStagedEnemy ? 0 : 8,
			filter: isStagedEnemy
				? "brightness(1) saturate(1) hue-rotate(0deg)"
				: "brightness(1) saturate(1) blur(4px)",
		});
		enemyControls.start({
			opacity: 1,
			scale: 1,
			y: 0,
			filter: "brightness(1) saturate(1) hue-rotate(0deg)",
			transition: { duration: isStagedEnemy ? 0.7 : 0.4, ease: "easeOut" },
		});
	}, [enemy, enemyControls, isStagedEnemy]);

	useEffect(() => {
		if (!lastDamagingHit) return;
		const amp = lastDamagingHit.isCrit ? 6 : 4;
		enemyControls.start({
			x: [0, -amp, amp, -Math.round(amp * 0.7), Math.round(amp * 0.5), 0],
			transition: { duration: 0.2, times: [0, 0.2, 0.4, 0.6, 0.8, 1] },
		});
		// Brief solid-red flash via the masked overlay. Opacity drives it so
		// the underlying sprite shows back through as the flash fades.
		redFlashControls.start({
			opacity: [0, 1, 0],
			transition: { duration: 0.22, times: [0, 0.18, 1], ease: "easeOut" },
		});
	}, [lastDamagingHit, enemyControls, redFlashControls]);

	useEffect(() => {
		if (state !== "victory" || !enemy) return;
		enemyControls.start({
			opacity: 0,
			y: isStagedEnemy ? 0 : 8,
			filter: isStagedEnemy
				? "brightness(1) saturate(1) hue-rotate(0deg)"
				: "brightness(1) saturate(1) blur(4px)",
			transition: { duration: 0.5, ease: "easeIn" },
		});
	}, [state, enemy, enemyControls, isStagedEnemy]);

	// Boss intro sfx — fires when the sprite stage begins so the entry roar
	// plays WHILE the boss materializes. The screenshake fires later at the
	// impact beat (after sprite is fully visible) for a two-phase buildup.
	useEffect(() => {
		if (state !== "boss_intro" || bossIntroStage !== "sprite") return;
		if (!bossConfig) return;
		playSfx(bossConfig.cinematic.entrySfx, { volume: 0.8 });
	}, [state, bossIntroStage, bossConfig]);

	// Boss intro screenshake — fires at the impact beat. Shakes the entire
	// combat section (arena, HP globe, time bar) via a CSS keyframe class
	// so the "ground trembles" while the meta UI (sidebar) stays stable.
	const sectionRef = useRef<HTMLElement>(null);
	const spriteGroupRef = useRef<HTMLDivElement>(null);
	const [isHoveringSprite, setIsHoveringSprite] = useState(false);
	const onSpriteEnter = useCallback(() => setIsHoveringSprite(true), []);
	const onSpriteLeave = useCallback(() => setIsHoveringSprite(false), []);
	useEffect(() => {
		if (state !== "boss_intro" || bossIntroStage !== "impact") return;
		if (!bossConfig || !sectionRef.current) return;
		const section = sectionRef.current;
		section.classList.add("boss-screenshake");
		const cleanup = () => section.classList.remove("boss-screenshake");
		section.addEventListener("animationend", cleanup, { once: true });
		return () => {
			section.removeEventListener("animationend", cleanup);
			section.classList.remove("boss-screenshake");
		};
	}, [state, bossIntroStage, bossConfig]);

	const inCamp = state === "acampamento";
	// Camp arrival is immediate: hitting the threshold triggers the HUD
	// fade-out and the cinematic at the same instant. The earlier staged
	// "Explorando…" pause was intentionally removed — felt like a delay,
	// not atmosphere. When the decision panel mounts (onPanelShow callback
	// below) the HUD fades back in alongside it — same "panel + HUD"
	// presence as ZoneCompletePanel.
	const [hudFading, setHudFading] = useState(false);
	const [cinematicEnabled, setCinematicEnabled] = useState(false);
	const [campSkipped, setCampSkipped] = useState(false);
	useEffect(() => {
		if (!inCamp) {
			setHudFading(false);
			setCinematicEnabled(false);
			setCampSkipped(false);
			return;
		}
		setHudFading(true);
		setCinematicEnabled(true);
	}, [inCamp]);

	// Click anywhere on the combat section while a camp's text stages run
	// jumps straight to the decision panel. Button clicks inside the panel
	// are unaffected — the skip handler no-ops once campSkipped flips.
	const handleSectionClick = () => {
		if (!inCamp || campSkipped) return;
		setCampSkipped(true);
	};

	return (
		<section
			ref={sectionRef}
			onClick={handleSectionClick}
			className="relative flex flex-col overflow-hidden rounded-md border border-white/40 bg-black"
		>
			{/* See CONTEXT.md → Time Bar. The bar itself stays full-opacity
			 * even during a camp — players need to see where they paused. */}
			<div
				role="progressbar"
				aria-label="Zone time progress"
				aria-valuenow={Math.round(calmariaElapsedMs)}
				aria-valuemin={0}
				aria-valuemax={calmariaBudgetMs}
				className="relative h-2 w-full bg-white/10"
			>
				<div
					className="h-full bg-gradient-to-r from-red-500 via-orange-400 to-yellow-300 transition-[width] duration-100 ease-linear"
					style={{ width: `${thresholdPct}%` }}
				/>
				{campThresholdsMs.map((thresholdMs) => {
					const left =
						calmariaBudgetMs > 0 ? (thresholdMs / calmariaBudgetMs) * 100 : 0;
					return (
						<span
							key={thresholdMs}
							aria-hidden
							className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute top-1/2 h-3 w-1 bg-amber-200 shadow-[0_0_6px_rgba(252,211,77,0.85)]"
							style={{ left: `${left}%` }}
						/>
					);
				})}
			</div>

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
			<div
				className={`flex h-[120px] flex-col items-center gap-1 px-6 pt-14 transition-opacity duration-[1200ms] ease-out ${
					hudFading ? "opacity-0" : "opacity-100"
				}`}
			>
				{enemy && (
					<motion.div
						className="flex flex-col items-center gap-1"
						initial={{ opacity: 0, y: 8 }}
						animate={{
							opacity: showNameplate ? 1 : 0,
							y: showNameplate ? 0 : 8,
						}}
						transition={{
							duration: 0.45,
							ease: "easeOut",
							// Stagger applies only to the reveal — keeping it on the
							// fade-out would make the nameplate linger past the sprite.
							delay: showNameplate ? nameplateDelay : 0,
						}}
					>
						<div
							className="display-title text-4xl uppercase tracking-[0.15em]"
							style={{ color: nameColor, textShadow: nameShadow }}
						>
							{enemyDisplayName}
						</div>
						<div className="text-lg uppercase tracking-[0.2em] text-white/60">
							Lv {enemy.level}
						</div>
					</motion.div>
				)}
			</div>

			<div className="relative flex flex-1 flex-col items-center justify-center gap-4">
				<div className="relative flex flex-1 items-center justify-center">
					{state === "searching" && !ambushActive && (
						<p className="animate-pulse text-xs uppercase tracking-[0.25em] text-white/40">
							{m.searching_enemy()}
						</p>
					)}
					{state === "miniboss_victory" && (
						<ZoneCompletePanel
							onContinue={onDismissMinibossModal}
							onRetreat={onRetreat}
							showContinue={!isBossNode}
						/>
					)}
					{inCamp && cinematicEnabled && (
						<CampCinematic
							zoneId={zoneId}
							source={campSource}
							skip={campSkipped}
							onReturn={onRetreat}
							onContinue={onDismissCamp}
							onPanelShow={() => setHudFading(false)}
						/>
					)}
					{enemy &&
						state !== "searching" &&
						state !== "miniboss_victory" &&
						state !== "acampamento" && (
							<div
								ref={spriteGroupRef}
								className="group relative"
								onMouseEnter={onSpriteEnter}
								onMouseLeave={onSpriteLeave}
							>
								<motion.div
									className={`relative h-64 w-64 ${enemy.rarity === "unique" ? "scale-150" : ""}`}
									animate={enemyControls}
								>
									<img
										src={enemy.def.sprite}
										alt={enemyDisplayName}
										draggable={false}
										className="pointer-events-none h-full w-full select-none object-contain"
									/>
									{/* Solid-red hit-flash silhouette: the sprite acts as the
									 * mask so only the opaque pixels get repainted, and the
									 * underlying image stays put. */}
									<motion.div
										aria-hidden
										initial={{ opacity: 0 }}
										animate={redFlashControls}
										className="pointer-events-none absolute inset-0"
										style={{
											backgroundColor: "#ff2a2a",
											WebkitMaskImage: `url(${enemy.def.sprite})`,
											maskImage: `url(${enemy.def.sprite})`,
											WebkitMaskRepeat: "no-repeat",
											maskRepeat: "no-repeat",
											WebkitMaskPosition: "center",
											maskPosition: "center",
											WebkitMaskSize: "contain",
											maskSize: "contain",
										}}
									/>
								</motion.div>
								<AnimatePresence>
									{lastSwingHit && (
										<HitFx
											key={lastSwingHit.id}
											weaponType={lastSwingHit.weaponType ?? "sword"}
											isCrit={lastSwingHit.isCrit}
										/>
									)}
								</AnimatePresence>
								{enemy.rarity !== "normal" && isHoveringSprite && (
									<SpriteTooltipPortal
										spriteRef={spriteGroupRef}
										enemy={enemy}
										bossConfig={bossConfig}
									/>
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
						initial={{ opacity: 0, y: -6 }}
						animate={{ opacity: showHpBar ? 1 : 0, y: showHpBar ? 0 : -6 }}
						transition={{
							duration: 0.45,
							ease: "easeOut",
							delay: showHpBar ? hpBarDelay : 0,
						}}
					>
						<EnemyHpBar
							current={enemy.currentHp}
							max={enemy.scaled.hp}
							currentBarrier={enemy.currentBarrier}
							maxBarrier={enemy.scaled.barrier}
						/>
					</motion.div>
				)}
			</div>

			{/* Bottom HUD: HP globe + XP bar + teleport stone + (wind-crystal counter / potion) */}
			<div
				className={`relative flex items-center gap-4 border-t border-white/15 bg-black/60 p-4 transition-opacity duration-[1200ms] ease-out ${
					hudFading ? "pointer-events-none opacity-0" : "opacity-100"
				}`}
			>
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

				{classId === "mage" && selectedElement && onSwitchElement && (
					<ElementSelector
						selected={selectedElement}
						onSwitch={onSwitchElement}
						onHover={(key) => onConsumableHover?.(key)}
						lastSwitchAt={lastElementSwitchAt}
					/>
				)}

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

				{/* Teleport stone — sends to city by default from the HUD (panic
				 * exit). Non-city destinations are picked from the map view. */}
				<div className="flex flex-col items-center gap-1">
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

				{/* Incenso Etéreo — invokes a camp on demand. Blocked during boss
				 * fight / camp / boss intro (see useCombatLoop.triggerIncense). */}
				<div className="flex flex-col items-center gap-1">
					<button
						type="button"
						onClick={onUseIncense}
						onMouseEnter={() => onConsumableHover?.("incense")}
						onMouseLeave={() => onConsumableHover?.(null)}
						onFocus={() => onConsumableHover?.("incense")}
						onBlur={() => onConsumableHover?.(null)}
						disabled={!canUseIncense}
						aria-label={m.incense_use_aria()}
						className="relative flex h-20 w-20 shrink-0 items-center justify-center border border-white/40 bg-black transition hover:border-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-black"
					>
						<Sparkles className="pointer-events-none h-10 w-10 text-purple-300/80" />
						<span className="absolute -bottom-1.5 -right-1.5 min-w-[1.25rem] border border-white/40 bg-black px-1 text-center text-[10px] leading-tight text-white">
							{incense}
						</span>
					</button>
				</div>

				<div className="flex flex-col items-center gap-1">
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
	showContinue = true,
}: {
	onContinue: () => void;
	onRetreat: () => void;
	showContinue?: boolean;
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
			<p className="max-w-sm text-balance text-center text-sm text-white/70">
				{m.miniboss_modal_body()}
			</p>
			<div className="flex gap-3">
				{showContinue && (
					<button
						type="button"
						onClick={onContinue}
						className="inline-flex items-center gap-2 border border-white/40 bg-black px-4 py-2 font-medium text-sm text-white/80 uppercase tracking-wider transition hover:border-white hover:bg-white/10 hover:text-white"
					>
						{m.miniboss_modal_continue()}
					</button>
				)}
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

function SpriteTooltipPortal({
	spriteRef,
	enemy,
	bossConfig,
}: {
	spriteRef: React.RefObject<HTMLDivElement | null>;
	enemy: Enemy;
	bossConfig: import("#/game/bosses").BossConfig | null;
}) {
	const el = spriteRef.current;
	if (!el) return null;
	const rect = el.getBoundingClientRect();
	return createPortal(
		<div
			className="pointer-events-none fixed z-[9999]"
			style={{
				top: rect.bottom + 8,
				left: rect.left + rect.width / 2,
				transform: "translateX(-50%)",
			}}
		>
			<MonsterTooltip enemy={enemy} bossConfig={bossConfig} />
		</div>,
		document.body,
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

function EnemyHpBar({
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
	const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
	const barrierPct =
		maxBarrier > 0
			? Math.max(0, Math.min(100, (currentBarrier / maxBarrier) * 100))
			: 0;
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

	const isHeal = event.isHealing;

	let color: string;
	let display: string;
	if (isHeal) {
		color = "text-green-400";
		display = `+${event.amount}`;
	} else if (event.isMiss) {
		color = "text-white/60";
		display = "MISS";
	} else if (isBlocked) {
		color = "text-blue-300";
		display = "BLOCK";
	} else if (isThorns) {
		color = "text-purple-300";
		display = `${event.amount}`;
	} else if (isCrit) {
		color = "text-red-500";
		display = `${event.amount}!!!`;
	} else {
		color = variant === "player" ? "text-red-400" : "text-white";
		display = `${event.amount}`;
	}

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
