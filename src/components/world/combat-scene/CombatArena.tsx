import { AnimatePresence, motion } from "framer-motion";
import { type ReactNode, useMemo } from "react";

import type { BossConfig } from "#/game/bosses";
import type { CampSource, DamageEvent, Enemy } from "#/hooks/useCombatLoop";

import CampScreen from "./CampScreen";
import EnemyHpBar from "./EnemyHpBar";
import EnemySprite from "./EnemySprite";
import { fightBackdropFor } from "./fight-backdrop";
import FloatingDamage from "./FloatingDamage";
import FloatingXp from "./FloatingXp";
import {
	type ArenaView,
	arenaView,
	hpBarVisible,
	type IntroStages,
	isStagedEnemy,
} from "./reveal";
import { useEnemySpriteMotion } from "./useEnemySpriteMotion";
import ZoneCompletePanel from "./ZoneCompletePanel";
import ZonePath, { type ZonePathState } from "./ZonePath";

const LAYER = {
	path: { className: "absolute inset-0 px-6 pt-16 pb-4", inS: 0.5, outS: 0.5 },
	fight: {
		className: "absolute inset-0 isolate flex flex-col items-center gap-4",
		inS: 0.5,
		outS: 0.5,
	},
	camp: {
		className: "absolute inset-0",
		inS: 4,
		outS: 0.25,
	},
} satisfies Record<ArenaView, { className: string; inS: number; outS: number }>;

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

	const layer = LAYER[view];
	const backdrop = fightBackdropFor(zoneId);
	const fight = (
		<>
			{backdrop && <FightBackdrop src={backdrop} />}
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
	);
	const content = {
		path: path.route && <ZonePath {...path} route={path.route} />,
		camp: (
			<CampScreen
				zoneId={zoneId}
				source={campSource}
				onReturn={onRetreat}
				onContinue={onDismissCamp}
			/>
		),
		fight,
	} satisfies Record<ArenaView, ReactNode>;

	return (
		<div className="relative min-h-0 flex-1">
			<AnimatePresence initial={false}>
				<motion.div
					key={view}
					initial={{ opacity: 0 }}
					animate={{
						opacity: 1,
						transition: { duration: layer.inS, ease: "easeInOut" },
					}}
					exit={{
						opacity: 0,
						pointerEvents: "none",
						transition: { duration: layer.outS, ease: "easeIn" },
					}}
					className={layer.className}
				>
					{content[view]}
				</motion.div>
			</AnimatePresence>
		</div>
	);
}

const BACKDROP_ZOOM = 1.35;

function FightBackdrop({ src }: { src: string }) {
	return (
		<div
			aria-hidden
			className="-z-10 pointer-events-none absolute inset-0 overflow-hidden"
			style={{ willChange: "transform" }}
		>
			<img
				src={src}
				alt=""
				data-testid="fight-backdrop"
				draggable={false}
				className="absolute bottom-0 left-1/2 max-w-none object-cover object-bottom"
				style={{
					width: `${BACKDROP_ZOOM * 100}%`,
					height: `${BACKDROP_ZOOM * 100}%`,
					transform: "translateX(-50%)",
				}}
			/>
			<div
				className="absolute inset-0"
				style={{
					background:
						"radial-gradient(ellipse 75% 70% at 50% 62%, transparent 35%, rgba(0, 0, 0, 0.75) 100%), linear-gradient(to bottom, rgba(0, 0, 0, 0.55), transparent 35%), linear-gradient(rgba(8, 10, 14, 0.42), rgba(8, 10, 14, 0.42))",
				}}
			/>
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
