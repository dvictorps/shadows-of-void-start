import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";

import type { BossConfig } from "#/game/bosses";
import type { CampSource, DamageEvent, Enemy } from "#/hooks/useCombatLoop";
import { m } from "#/paraglide/messages";

import CampCinematic from "../CampCinematic";
import EnemyHpBar from "./EnemyHpBar";
import EnemySprite from "./EnemySprite";
import FloatingDamage from "./FloatingDamage";
import FloatingXp from "./FloatingXp";
import { hpBarVisible, type IntroStages, isStagedEnemy } from "./reveal";
import { useEnemySpriteMotion } from "./useEnemySpriteMotion";
import ZoneCompletePanel from "./ZoneCompletePanel";

/**
 * The scene's center: whatever occupies the enemy's spot in each state
 * (searching line, sprite, zone-complete panel, camp cinematic), the
 * popups over it, and the enemy HP bar slot under it.
 */
export default function CombatArena({
	stages,
	enemy,
	displayName,
	bossConfig,
	events,
	ambushActive,
	lastKillXp,
	isBossNode,
	onDismissMinibossModal,
	onRetreat,
	zoneId,
	campSource,
	campSkipped,
	onDismissCamp,
	onCampPanelShow,
}: {
	stages: IntroStages;
	enemy: Enemy | null;
	displayName: string;
	bossConfig: BossConfig | null;
	events: DamageEvent[];
	ambushActive: boolean;
	lastKillXp?: number;
	isBossNode: boolean;
	onDismissMinibossModal: () => void;
	onRetreat: () => void;
	zoneId: string;
	campSource: CampSource;
	campSkipped: boolean;
	onDismissCamp: () => void;
	onCampPanelShow: () => void;
}) {
	const { state } = stages;
	const enemyEvents = useMemo(
		() => events.filter((e) => e.target === "enemy"),
		[events],
	);
	// Latest event the player landed on the enemy with a weapon. Drives the
	// HitFx mount (renders even on block, per design — block animates the
	// visual but the enemy reaction below skips).
	const lastSwingHit = useMemo(
		() => enemyEvents.findLast((e) => e.weaponType && !e.isMiss) ?? null,
		[enemyEvents],
	);
	const { enemyControls, redFlashControls } = useEnemySpriteMotion({
		enemy,
		state,
		enemyEvents,
	});
	const enemyOnStage =
		state !== "searching" &&
		state !== "miniboss_victory" &&
		state !== "acampamento";

	return (
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
				{state === "acampamento" && (
					<CampCinematic
						zoneId={zoneId}
						source={campSource}
						skip={campSkipped}
						onReturn={onRetreat}
						onContinue={onDismissCamp}
						onPanelShow={onCampPanelShow}
					/>
				)}
				{enemy && enemyOnStage && (
					<EnemySprite
						enemy={enemy}
						displayName={displayName}
						bossConfig={bossConfig}
						enemyControls={enemyControls}
						redFlashControls={redFlashControls}
						lastSwingHit={lastSwingHit}
					/>
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
						{state === "victory" && lastKillXp !== undefined && (
							<FloatingXp amount={lastKillXp} />
						)}
					</AnimatePresence>
				</div>
			</div>

			{/* HP bar slot. Always reserved when an enemy is present so the
			 * sprite above doesn't shift when the bar fades in during
			 * boss_intro stage 3. */}
			{enemy && state !== "miniboss_victory" && (
				<EnemyHpBarSlot enemy={enemy} visible={hpBarVisible(stages)} />
			)}
		</div>
	);
}

function EnemyHpBarSlot({
	enemy,
	visible,
}: {
	enemy: Enemy;
	visible: boolean;
}) {
	return (
		<motion.div
			className="flex w-full justify-center"
			initial={{ opacity: 0, y: -6 }}
			animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : -6 }}
			transition={{
				duration: 0.45,
				ease: "easeOut",
				delay: visible && !isStagedEnemy(enemy) ? 0.16 : 0,
			}}
		>
			<EnemyHpBar
				current={enemy.currentHp}
				max={enemy.scaled.hp}
				currentBarrier={enemy.currentBarrier}
				maxBarrier={enemy.scaled.barrier}
			/>
		</motion.div>
	);
}
