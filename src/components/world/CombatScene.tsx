// The combat view: composes the pieces under ./combat-scene and owns only
// what spans them (the camp's HUD fade and skip, the boss screenshake).
// Pinned by CombatScene.test.tsx. A new concern (overlay, HUD block, state
// machine) goes into its own file under ./combat-scene, not inline here.
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

// The scene's own props; the bottom HUD's pass straight through.
type SceneProps = {
	zoneName: string;
	zoneLevel: number;
	state: CombatSceneState;
	isBossNode: boolean;
	rareIntroStage: RareIntroStage;
	bossIntroStage: BossIntroStage;
	enemy: Enemy | null;
	// XP from the most recent kill — fires a floating popup when state goes
	// engaged → victory. Persists across the victory frame so the popup has a
	// value to read.
	lastKillXp?: number;
	// Active camp source — drives flavor text + (future) ambient audio in the
	// cinematic. See CONTEXT.md → Incenso Etéreo.
	campSource: CampSource;
	// True while an ambush pack is firing — drives the "Ambush!" banner. See
	// CONTEXT.md → Ambush events.
	ambushActive: boolean;
	onRetreat: () => void;
	bagCount: number;
	onOpenBag: () => void;
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
	// The static BOSSES entry, so its identity is stable across renders for
	// the screenshake effect keyed on it.
	const bossConfig = enemy ? getBossConfig(enemy) : null;
	// Read once per render — both the nameplate text and the img alt need it.
	const enemyDisplayName = enemy ? translateEnemyName(enemy) : "";
	const stages = { state, rareIntroStage, bossIntroStage };

	// Boss intro screenshake — fires at the impact beat. Shakes the entire
	// combat section (arena, HP globe, time bar) via a CSS keyframe class
	// so the "ground trembles" while the meta UI (sidebar) stays stable.
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
	// Camp arrival is immediate: hitting the threshold triggers the HUD
	// fade-out and the cinematic at the same instant. The earlier staged
	// "Explorando…" pause was intentionally removed — felt like a delay,
	// not atmosphere. When the decision panel mounts (onCampPanelShow) the
	// HUD fades back in alongside it — same "panel + HUD" presence as
	// ZoneCompletePanel.
	const [hudFading, setHudFading] = useState(false);
	const [campSkipped, setCampSkipped] = useState(false);
	// Camp entry/exit resets the HUD fade and skip flag during render (React's
	// "adjust state when a prop changes" pattern). Starts at `false` so a
	// mount that is already in camp still runs the entry branch.
	const [prevInCamp, setPrevInCamp] = useState(false);
	if (inCamp !== prevInCamp) {
		setPrevInCamp(inCamp);
		setHudFading(inCamp);
		if (!inCamp) setCampSkipped(false);
	}

	// Stable: CampCinematic's stage effect lists it as a dependency, so a new
	// identity per render would restart the stage timer.
	const onCampPanelShow = useCallback(() => setHudFading(false), []);

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
