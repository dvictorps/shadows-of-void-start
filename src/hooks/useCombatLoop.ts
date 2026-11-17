import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { bossIntroStageMsFor, findBoss, getBossConfig } from "#/game/bosses";
import type { CombatPhase } from "#/game/combat/constants";
import {
	type BossIntroStage,
	type CombatState,
	derivePhase,
	type Enemy,
	RARE_INTRO_STAGE_MS,
	type RareIntroStage,
} from "#/game/combat/types";
import { rollMonsterLevel } from "#/game/loot/drops";
import {
	applyMonsterMods,
	findMonster,
	type MonsterId,
	type MonsterRarity,
	modCountForRarity,
	rollMonsterMods,
	scaleMonsterStats,
} from "#/game/monsters";
import type { ComputedCharacterStats } from "#/game/stats/types";
import type { BossNodeConfig, CampSource } from "#/game/world";
import type { ZoneEncounterPlan } from "#/game/world/encounter-schedule";
import { pickRandom, randomUnit } from "#/lib/rng";
import { playKillSfx, playSfx } from "#/lib/sfx";

import type { BarrierApi } from "./useBarrier";
import type { CombatMutations } from "./useCombatMutations";
import { useCombatTick, type Vitals } from "./useCombatTick";
import { type DamageEvent, useDamageEvents } from "./useDamageEvents";
import { useDelay } from "./useDelay";
import { useEncounterSchedule } from "./useEncounterSchedule";
import { useStageCascade } from "./useStageCascade";

export type {
	BossIntroStage,
	CampSource,
	CombatPhase,
	DamageEvent,
	Enemy,
	RareIntroStage,
};

type ArgsOf<Name extends keyof CombatMutations> = Parameters<
	CombatMutations[Name]
>[0];

export interface CombatServer {
	recordKill: (args: ArgsOf<"recordKill">) => Promise<{
		potionDropped: boolean;
		newMaxLife?: number;
		newMaxBarrier?: number;
	}>;
	syncHp: (args: ArgsOf<"syncHp">) => Promise<object>;
	consumePotion: (args: ArgsOf<"consumePotion">) => Promise<object>;
	consumeIncense: (args: ArgsOf<"consumeIncense">) => Promise<object>;
	enterCamp: (args: ArgsOf<"enterCamp">) => Promise<object>;
	enterCampViaIncense: (args: ArgsOf<"enterCampViaIncense">) => Promise<object>;
	exitCamp: (args: ArgsOf<"exitCamp">) => Promise<object>;
}

type Params = {
	characterId: number;
	server: CombatServer;
	stats: ComputedCharacterStats;
	initialHp: number;
	barrierApi: BarrierApi;
	potions: number;
	incense: number;
	monsterPool: readonly MonsterId[];
	zoneLevel: number;
	encounterPlan: ZoneEncounterPlan;
	bossNode?: BossNodeConfig | null;
	serverBudgetMs: number | null;
	serverCampThresholdsMs: readonly number[];
	active: boolean;
	onPlayerDeath: () => void;
};

const VICTORY_DELAY_MS = 800;

function bossProgressFor(bossNode: BossNodeConfig | null | undefined) {
	return {
		warmupDone: !bossNode?.warmupSeconds,
		gauntletFightIndex: bossNode && bossNode.gauntlet.fights > 0 ? 1 : null,
	};
}

const NOOP_RESTORE = (_overrideMaxHp?: number) => {};
const NO_VITALS = (): Vitals | null => null;
const NOOP = () => {};

export function useCombatLoop({
	characterId,
	server,
	stats,
	initialHp,
	barrierApi,
	potions,
	incense,
	monsterPool,
	zoneLevel,
	encounterPlan,
	bossNode,
	serverBudgetMs,
	serverCampThresholdsMs,
	active,
	onPlayerDeath,
}: Params) {
	const [state, setState] = useState<CombatState>("searching");
	const [rareIntroStage, setRareIntroStage] = useState<RareIntroStage>(null);
	const [bossIntroStage, setBossIntroStage] = useState<BossIntroStage>(null);
	const [enemy, setEnemy] = useState<Enemy | null>(null);
	const [warmupDone, setWarmupDone] = useState(
		() => bossProgressFor(bossNode).warmupDone,
	);
	const [gauntletFightIndex, setGauntletFightIndex] = useState<number | null>(
		() => bossProgressFor(bossNode).gauntletFightIndex,
	);
	const pendingIncenseRef = useRef(false);
	const [lastKill, setLastKill] = useState<{
		xp: number;
		potion: boolean;
	} | null>(null);
	const { events, push: pushEvent } = useDamageEvents();

	const lastKillWasMinibossRef = useRef(false);

	const stateRef = useRef(state);
	const enemyRef = useRef<Enemy | null>(enemy);
	useLayoutEffect(() => {
		stateRef.current = state;
		enemyRef.current = enemy;
	});

	const {
		recordKill,
		syncHp,
		consumePotion: consumePotionMutation,
		consumeIncense,
		enterCamp,
		enterCampViaIncense,
		exitCamp: exitCampMutation,
	} = server;

	const warmupActive = !!bossNode && !warmupDone;

	const {
		resetForMiniboss,
		startVisit: startScheduleVisit,
		isAmbushPackActive,
		startIncenseCamp,
		calmariaElapsedMs,
		...schedule
	} = useEncounterSchedule({
		active,
		encounterPlan,
		monsterPool,
		serverBudgetMs,
		serverCampThresholdsMs,
		isSearching: state === "searching" && (!bossNode || warmupActive),
		postMinibossPauseRef: lastKillWasMinibossRef,
		onCampTriggered: (thresholdIndex) => {
			if (bossNode) return;
			stateRef.current = "acampamento";
			setState("acampamento");
			enterCamp({ characterId, thresholdIndex }).catch(() => {});
		},
		onEncounter: (monsterId, rarity) => {
			const e = spawnMonster(monsterId, rarity);
			if (e) engageSpawned(e);
		},
		onExitReached: () => {
			if (bossNode) return;
			const e = spawnMob(monsterPool, "rare");
			if (e) engageSpawned(e);
		},
	});

	const warmupBudgetMs = (bossNode?.warmupSeconds ?? 0) * 1000;
	if (
		bossNode &&
		!warmupDone &&
		warmupBudgetMs > 0 &&
		calmariaElapsedMs >= warmupBudgetMs
	) {
		setWarmupDone(true);
	}

	const syncVitals = useCallback(
		async (vitals: Vitals) => {
			await syncHp({ characterId, ...vitals });
		},
		[syncHp, characterId],
	);
	const consumePotion = useCallback(
		async (clientHp: number) => {
			await consumePotionMutation({ characterId, clientHp });
		},
		[consumePotionMutation, characterId],
	);

	const updateEnemyForTick = useCallback((next: Enemy) => {
		enemyRef.current = next;
		setEnemy(next);
	}, []);

	const restoreToFullRef =
		useRef<(overrideMaxHp?: number) => void>(NOOP_RESTORE);
	const vitalsForKillRef = useRef<() => Vitals | null>(NO_VITALS);
	const forgetSyncedVitalsRef = useRef<() => void>(NOOP);

	const resolveKill = useCallback(
		(killed: Enemy) => {
			const xpGained = killed.scaled.xpReward;
			stateRef.current = "victory";
			setLastKill({ xp: xpGained, potion: false });
			setState("victory");
			playKillSfx(killed);
			const inBossNode = bossNode != null;
			const isMinibossKill = killed.rarity === "rare" && !inBossNode;
			const isBossKill = killed.rarity === "unique";
			lastKillWasMinibossRef.current = isMinibossKill || isBossKill;
			if (isMinibossKill || isBossKill) resetForMiniboss();
			if (isBossKill) {
				const restart = bossProgressFor(bossNode);
				setWarmupDone(restart.warmupDone);
				setGauntletFightIndex(restart.gauntletFightIndex);
			}
			const vitals = vitalsForKillRef.current();
			void (async () => {
				try {
					const result = await recordKill({
						characterId,
						monsterId: killed.def.id,
						monsterLevel: killed.level,
						monsterRarity: killed.rarity,
						clientHp: vitals?.hpCurrent,
						clientBarrier: vitals?.barrierCurrent,
					});
					if (result.newMaxLife !== undefined) {
						restoreToFullRef.current(result.newMaxLife);
						barrierApi.restoreToFull(result.newMaxBarrier);
					}
					if (result.potionDropped) {
						setLastKill({ xp: xpGained, potion: true });
					}
				} catch {
					forgetSyncedVitalsRef.current();
				}
			})();
		},
		[bossNode, characterId, recordKill, resetForMiniboss, barrierApi],
	);

	const {
		playerHp,
		drinkPotion,
		restoreToFull,
		vitalsForKill,
		forgetSyncedVitals,
		startVisit: startTickVisit,
	} = useCombatTick({
		active,
		isEngaged: state === "engaged",
		enemy,
		stats,
		initialHp,
		potions,
		barrierApi,
		onPlayerDeath,
		resolveKill,
		pushEvent,
		updateEnemy: updateEnemyForTick,
		syncVitals,
		consumePotion,
	});
	useLayoutEffect(() => {
		restoreToFullRef.current = restoreToFull;
		vitalsForKillRef.current = vitalsForKill;
		forgetSyncedVitalsRef.current = forgetSyncedVitals;
	});

	const startVisit = useCallback(
		(nextBossNode: BossNodeConfig | null) => {
			pendingIncenseRef.current = false;
			lastKillWasMinibossRef.current = false;
			enemyRef.current = null;
			setEnemy(null);
			setLastKill(null);
			setRareIntroStage(null);
			setBossIntroStage(null);
			const progress = bossProgressFor(nextBossNode);
			setWarmupDone(progress.warmupDone);
			setGauntletFightIndex(progress.gauntletFightIndex);
			stateRef.current = "searching";
			setState("searching");
			startScheduleVisit();
			startTickVisit();
		},
		[startScheduleVisit, startTickVisit],
	);

	const dismissCamp = useCallback(() => {
		if (stateRef.current !== "acampamento") return;
		stateRef.current = "searching";
		setState("searching");
		exitCampMutation({ characterId }).catch(() => {});
	}, [characterId, exitCampMutation]);

	const triggerIncense = useCallback(() => {
		if (incense <= 0) return;
		const s = stateRef.current;
		if (
			s === "rare_intro" ||
			s === "boss_intro" ||
			s === "acampamento" ||
			s === "miniboss_victory"
		)
			return;
		if (
			s === "engaged" &&
			(enemyRef.current?.rarity === "rare" ||
				enemyRef.current?.rarity === "unique")
		)
			return;
		if (isAmbushPackActive()) return;

		consumeIncense({ characterId }).catch(() => {});

		if (s === "engaged") {
			pendingIncenseRef.current = true;
			return;
		}
		startIncenseCamp();
		stateRef.current = "acampamento";
		setState("acampamento");
		enterCampViaIncense({ characterId }).catch(() => {});
	}, [
		characterId,
		consumeIncense,
		enterCampViaIncense,
		incense,
		isAmbushPackActive,
		startIncenseCamp,
	]);

	function spawnMob(
		pool: readonly MonsterId[],
		rarity: MonsterRarity,
	): Enemy | null {
		const pick = pickRandom(pool);
		return pick ? spawnMonster(pick, rarity) : null;
	}

	function spawnMonster(id: MonsterId, rarity: MonsterRarity): Enemy | null {
		const def = findMonster(id);
		if (!def) return null;
		const level = rollMonsterLevel(zoneLevel);
		const baseScaled = scaleMonsterStats(def, level);
		const mods = rollMonsterMods(modCountForRarity(rarity));
		const scaled = applyMonsterMods(baseScaled, mods);
		return {
			def,
			currentHp: scaled.hp,
			currentBarrier: scaled.barrier,
			level,
			rarity,
			mods,
			scaled,
			nameSeed: {
				primary: randomUnit(),
				secondary: randomUnit(),
				epithet: randomUnit(),
			},
		};
	}

	function commitEnemy(e: Enemy) {
		enemyRef.current = e;
		setEnemy(e);
	}

	function engageSpawned(e: Enemy) {
		commitEnemy(e);
		if (e.rarity === "rare") {
			setRareIntroStage("sprite");
			stateRef.current = "rare_intro";
			setState("rare_intro");
			return;
		}
		setRareIntroStage(null);
		stateRef.current = "engaged";
		setState("engaged");
	}

	useDelay(
		active && state === "searching" && !!bossNode && warmupDone,
		600,
		() => {
			if (!bossNode) return;
			if (gauntletFightIndex !== null) {
				const e = spawnMob(bossNode.gauntlet.monsterPool, "rare");
				if (!e) return;
				commitEnemy(e);
				setRareIntroStage("sprite");
				stateRef.current = "rare_intro";
				setState("rare_intro");
				return;
			}
			const boss = findBoss(bossNode.bossId);
			if (!boss) return;
			const scaled = scaleMonsterStats(boss.template, boss.level);
			const bossEnemy: Enemy = {
				def: boss.template,
				currentHp: scaled.hp,
				currentBarrier: scaled.barrier,
				level: boss.level,
				rarity: "unique",
				mods: [],
				scaled,
				nameSeed: { primary: 0, secondary: 0, epithet: 0 },
			};
			commitEnemy(bossEnemy);
			setBossIntroStage("sprite");
			stateRef.current = "boss_intro";
			setState("boss_intro");
			const bossConfig = getBossConfig(bossEnemy);
			if (bossConfig) playSfx(bossConfig.cinematic.entrySfx, { volume: 0.8 });
		},
	);

	const engage = () => {
		stateRef.current = "engaged";
		setState("engaged");
	};
	useStageCascade(
		active && state === "rare_intro",
		rareIntroStage,
		RARE_INTRO_STAGE_MS,
		setRareIntroStage,
		engage,
	);
	useStageCascade(
		active && state === "boss_intro",
		bossIntroStage,
		bossIntroStageMsFor(enemy),
		setBossIntroStage,
		engage,
	);

	useDelay(active && state === "victory", VICTORY_DELAY_MS, () => {
		const killedEnemy = enemyRef.current;
		enemyRef.current = null;
		setEnemy(null);
		setLastKill(null);
		if (
			bossNode &&
			gauntletFightIndex !== null &&
			killedEnemy?.rarity === "rare"
		) {
			const nextIndex = gauntletFightIndex + 1;
			setGauntletFightIndex(
				nextIndex > bossNode.gauntlet.fights ? null : nextIndex,
			);
			setState("searching");
			return;
		}
		if (lastKillWasMinibossRef.current) {
			lastKillWasMinibossRef.current = false;
			stateRef.current = "miniboss_victory";
			setState("miniboss_victory");
		} else if (pendingIncenseRef.current) {
			pendingIncenseRef.current = false;
			startIncenseCamp();
			stateRef.current = "acampamento";
			setState("acampamento");
			enterCampViaIncense({ characterId }).catch(() => {});
		} else {
			setState("searching");
		}
	});

	const dismissMinibossModal = useCallback(() => {
		if (stateRef.current !== "miniboss_victory") return;
		stateRef.current = "searching";
		setState("searching");
		exitCampMutation({ characterId }).catch(() => {});
	}, [characterId, exitCampMutation]);

	return {
		state,
		rareIntroStage,
		bossIntroStage,
		enemy,
		playerHp,
		potions,
		incense,
		campSource: schedule.campSource,
		ambushActive: schedule.ambushActive,
		route: schedule.route,
		routeSeed: schedule.routeSeed,
		nextStopIndex: schedule.nextStopIndex,
		incenseCampsMs: schedule.incenseCampsMs,
		events,
		lastKill,
		drinkPotion,
		triggerIncense,
		calmariaElapsedMs,
		dismissMinibossModal,
		startVisit,
		dismissCamp,
		phase: derivePhase(state),
	};
}
