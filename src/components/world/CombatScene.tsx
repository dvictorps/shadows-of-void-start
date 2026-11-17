import { useCallback, useEffect, useRef, useState } from "react";

import { getBossConfig } from "#/game/bosses";
import { translateEnemyName } from "#/game/world/i18n";
import type {
	BossIntroStage,
	CampSource,
	Enemy,
	RareIntroStage,
} from "#/hooks/useCombatLoop";

import CombatArena from "./combat-scene/CombatArena";
import CombatBottomHud, {
	type CombatBottomHudProps,
} from "./combat-scene/CombatBottomHud";
import CombatTopHud from "./combat-scene/CombatTopHud";
import EnemyNameplate from "./combat-scene/EnemyNameplate";
import type { CombatSceneState } from "./combat-scene/reveal";

export type { ConsumableKey } from "./combat-scene/CombatBottomHud";

type SceneProps = {
	zoneName: string;
	zoneLevel: number;
	state: CombatSceneState;
	isBossNode: boolean;
	rareIntroStage: RareIntroStage;
	bossIntroStage: BossIntroStage;
	enemy: Enemy | null;
	lastKillXp?: number;
	campSource: CampSource;
	ambushActive: boolean;
	onRetreat: () => void;
	bagCount: number;
	onOpenBag: () => void;
	calmariaElapsedMs: number;
	calmariaBudgetMs: number;
	campThresholdsMs: readonly number[];
	onDismissMinibossModal: () => void;
	zoneId: string;
	onDismissCamp: () => void;
};

type Props = SceneProps & Omit<CombatBottomHudProps, "hudFading">;

export default function CombatScene({
	zoneName,
	zoneLevel,
	state,
	isBossNode,
	rareIntroStage,
	bossIntroStage,
	enemy,
	events,
	ambushActive,
	onRetreat,
	bagCount,
	onOpenBag,
	calmariaElapsedMs,
	calmariaBudgetMs,
	campThresholdsMs,
	lastKillXp,
	onDismissMinibossModal,
	zoneId,
	campSource,
	onDismissCamp,
	...bottomHud
}: Props) {
	const bossConfig = enemy ? getBossConfig(enemy) : null;
	const enemyDisplayName = enemy ? translateEnemyName(enemy) : "";
	const stages = { state, rareIntroStage, bossIntroStage };

	const sectionRef = useRef<HTMLElement>(null);
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
	const [hudFading, setHudFading] = useState(false);
	const [campSkipped, setCampSkipped] = useState(false);
	const [prevInCamp, setPrevInCamp] = useState(false);
	if (inCamp !== prevInCamp) {
		setPrevInCamp(inCamp);
		setHudFading(inCamp);
		if (!inCamp) setCampSkipped(false);
	}

	const onCampPanelShow = useCallback(() => setHudFading(false), []);

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
			<CombatTopHud
				zoneName={zoneName}
				zoneLevel={zoneLevel}
				calmariaElapsedMs={calmariaElapsedMs}
				calmariaBudgetMs={calmariaBudgetMs}
				campThresholdsMs={campThresholdsMs}
				ambushActive={ambushActive}
				hudFading={hudFading}
				bagCount={bagCount}
				onOpenBag={onOpenBag}
				onRetreat={onRetreat}
			/>
			<EnemyNameplate
				enemy={enemy}
				displayName={enemyDisplayName}
				bossConfig={bossConfig}
				stages={stages}
				hudFading={hudFading}
			/>
			<CombatArena
				stages={stages}
				enemy={enemy}
				displayName={enemyDisplayName}
				bossConfig={bossConfig}
				events={events}
				ambushActive={ambushActive}
				lastKillXp={lastKillXp}
				isBossNode={isBossNode}
				onDismissMinibossModal={onDismissMinibossModal}
				onRetreat={onRetreat}
				zoneId={zoneId}
				campSource={campSource}
				campSkipped={campSkipped}
				onDismissCamp={onDismissCamp}
				onCampPanelShow={onCampPanelShow}
			/>
			<CombatBottomHud hudFading={hudFading} events={events} {...bottomHud} />
		</section>
	);
}
