import { useEffect, useRef } from "react";

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
import type { ZonePathState } from "./combat-scene/ZonePath";

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
	path: ZonePathState;
	onDismissMinibossModal: () => void;
	zoneId: string;
	onDismissCamp: () => void;
};

type Props = SceneProps & CombatBottomHudProps;

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
	path,
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

	return (
		<section
			ref={sectionRef}
			className="relative flex flex-col overflow-hidden rounded-md border border-white/40 bg-black"
		>
			<CombatTopHud
				zoneName={zoneName}
				zoneLevel={zoneLevel}
				ambushActive={ambushActive}
				bagCount={bagCount}
				onOpenBag={onOpenBag}
				onRetreat={onRetreat}
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
				onDismissCamp={onDismissCamp}
				path={path}
				nameplate={
					<EnemyNameplate
						enemy={enemy}
						displayName={enemyDisplayName}
						bossConfig={bossConfig}
						stages={stages}
					/>
				}
			/>
			<CombatBottomHud events={events} {...bottomHud} />
		</section>
	);
}
