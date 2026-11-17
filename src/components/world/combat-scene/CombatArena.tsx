import { AnimatePresence, motion } from "framer-motion";
import { type ReactNode, useMemo } from "react";

import type { BossConfig } from "#/game/bosses";
import type { CampSource, DamageEvent, Enemy } from "#/hooks/useCombatLoop";

import CampScreen from "./CampScreen";
import EnemyHpBar from "./EnemyHpBar";
import EnemySprite from "./EnemySprite";
import FloatingDamage from "./FloatingDamage";
import FloatingXp from "./FloatingXp";
import {
	arenaView,
	hpBarVisible,
	type IntroStages,
	isStagedEnemy,
} from "./reveal";
import { useEnemySpriteMotion } from "./useEnemySpriteMotion";
import ZoneCompletePanel from "./ZoneCompletePanel";
import ZonePath, { type ZonePathState } from "./ZonePath";

const FADE_S = 0.5;
const LAYER_CLASS = {
	path: "absolute inset-0 px-6 pt-16 pb-4",
	fight: "absolute inset-0 flex flex-col items-center gap-4",
} as const;

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
	onDismissCamp,
	path,
	nameplate,
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
	onDismissCamp: () => void;
	path: ZonePathState;
	nameplate: ReactNode;
}) {
	const { state } = stages;
	const enemyEvents = useMemo(
		() => events.filter((e) => e.target === "enemy"),
		[events],
	);
	const lastSwingHit = useMemo(
		() => enemyEvents.findLast((e) => e.weaponType && !e.isMiss) ?? null,
		[enemyEvents],
	);
	const { enemyControls, redFlashControls } = useEnemySpriteMotion({
		enemy,
		state,
		enemyEvents,
	});
	const enemyOnStage = state !== "searching" && state !== "miniboss_victory";
	const view = arenaView(state, ambushActive);

	if (view === "camp") {
		return (
			<div className="relative flex min-h-0 flex-1 items-center justify-center">
				<CampScreen
					zoneId={zoneId}
					source={campSource}
					onReturn={onRetreat}
					onContinue={onDismissCamp}
				/>
			</div>
		);
	}

	return (
		<div className="relative min-h-0 flex-1">
			<AnimatePresence initial={false}>
				<motion.div
					key={view}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: FADE_S, ease: "easeInOut" }}
					className={LAYER_CLASS[view]}
				>
					{view === "path" ? (
						<ZonePath {...path} />
					) : (
						<>
							{nameplate}
							<div className="relative flex w-full flex-1 items-center justify-center">
								{state === "miniboss_victory" && (
									<ZoneCompletePanel
										onContinue={onDismissMinibossModal}
										onRetreat={onRetreat}
										showContinue={!isBossNode}
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

								<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
									<AnimatePresence>
										{enemyEvents.map((event) => (
											<FloatingDamage key={event.id} event={event} />
										))}
									</AnimatePresence>
								</div>

								<div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
									<AnimatePresence>
										{state === "victory" && lastKillXp !== undefined && (
											<FloatingXp amount={lastKillXp} />
										)}
									</AnimatePresence>
								</div>
							</div>

							{enemy && state !== "miniboss_victory" && (
								<EnemyHpBarSlot enemy={enemy} visible={hpBarVisible(stages)} />
							)}
						</>
					)}
				</motion.div>
			</AnimatePresence>
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
