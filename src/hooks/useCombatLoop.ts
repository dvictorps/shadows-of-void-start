// ─────────────────────────────────────────────────────────────────────────────
//  Combat orchestrator. Owns the state machine + spawn/victory delays + the
//  recordKill / incense / camp calls (`server`: the route passes
//  useCombatMutations, tests pass fakes). Tick mechanics
//  live in `useCombatTick`; encounter scheduling in `useEncounterSchedule`.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { findBoss, getBossConfig } from "#/game/bosses";
import type { CombatPhase } from "#/game/combat/constants";
import {
	BOSS_INTRO_STAGE_MS_DEFAULT,
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
	rollMonsterRarity,
	scaleMonsterStats,
} from "#/game/monsters";
import type { ComputedCharacterStats } from "#/game/stats/types";
import type { BossNodeConfig, CampSource } from "#/game/world";
import type { ZoneEncounterPlan } from "#/game/world/encounter-schedule";
import { pickRandom } from "#/lib/rng";
import { playKillSfx, playSfx } from "#/lib/sfx";

import type { BarrierApi } from "./useBarrier";
import type { CombatMutations } from "./useCombatMutations";
import { useCombatTick, type Vitals } from "./useCombatTick";
import { type DamageEvent, useDamageEvents } from "./useDamageEvents";
import { useDelay } from "./useDelay";
import { useEncounterSchedule } from "./useEncounterSchedule";
import { useStageCascade } from "./useStageCascade";

// CampSource / DamageEvent are passed through unchanged to CombatScene; the
// other re-exports give external consumers a single import surface for the
// hook's domain types.
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

/**
 * The server calls the loop makes, as it uses them: only `recordKill`'s answer
 * is read, the rest are fire-and-forget. The route passes `useCombatMutations`;
 * tests pass fakes (no module mocking).
 */
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
	// Live potion count from the character query. The hook does NOT keep a
	// local copy — drink + drop are both server-driven, and tracking the
	// number in two places lets concurrent mutations race ("drink ghost"
	// bug where a drop arrived during the drink and the local +1 from the
	// drop overwrote the optimistic -1 from the drink).
	potions: number;
	// Live ethereal-incense count from the character query. Same rationale
	// as `potions` — keep the source of truth on the server side so a kill's
	// optimistic drop can't race the consume.
	incense: number;
	monsterPool: readonly MonsterId[];
	zoneLevel: number;
	encounterPlan: ZoneEncounterPlan;
	// When set, the node is a boss-node gauntlet. Bypasses the time-bar
	// scheduler — spawns N back-to-back rares from `gauntlet.monsterPool`,
	// then the boss looked up via findBoss(bossId). Re-entering the node
	// restarts the gauntlet from fight 1 (no mid-gauntlet checkpoint).
	// See CONTEXT.md → Act Boss / Boss Cinematic.
	bossNode?: BossNodeConfig | null;
	// Camp thresholds (cumulative calmaria ms) rolled server-side by enterZone
	// and persisted on the character. Empty until enterZone resolves — the
	// ticker simply has no camps to fire during that gap. See
	// docs/plans/in-progress.md "Server-authoritative camp/phase derivation".
	serverCampThresholdsMs: readonly number[];
	active: boolean;
	onPlayerDeath: () => void;
};

const VICTORY_DELAY_MS = 800;

/** A boss node's progress at the start of a visit: warmup pending, gauntlet at fight 1. */
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
	serverCampThresholdsMs,
	active,
	onPlayerDeath,
}: Params) {
	const [state, setState] = useState<CombatState>("searching");
	const [rareIntroStage, setRareIntroStage] = useState<RareIntroStage>(null);
	const [bossIntroStage, setBossIntroStage] = useState<BossIntroStage>(null);
	const [enemy, setEnemy] = useState<Enemy | null>(null);
	// Boss-node warmup: regular mob spawns until the calmaria budget fills
	// (budget = warmupSeconds). `false` during warmup, `true` once the
	// schedule's calmaria fills. Always `true` when there's no warmup.
	const [warmupDone, setWarmupDone] = useState(
		() => bossProgressFor(bossNode).warmupDone,
	);
	// Boss-node gauntlet progress. 1..N = next gauntlet rare to spawn;
	// `null` while not in a boss node or once the gauntlet is exhausted
	// (boss next). Rewound to 1 by `startVisit`.
	const [gauntletFightIndex, setGauntletFightIndex] = useState<number | null>(
		() => bossProgressFor(bossNode).gauntletFightIndex,
	);
	// Set true when the player triggers incenso during "engaged" — the
	// post-victory transition reads this and routes to camp instead of
	// the next spawn. Cleared by `startVisit` and on consumption.
	const pendingIncenseRef = useRef(false);
	const [lastKill, setLastKill] = useState<{
		xp: number;
		potion: boolean;
	} | null>(null);
	const { events, push: pushEvent } = useDamageEvents();

	// Read by the victory-delay handler — state and lastKill have already been
	// reset by then, so we can't recover the rarity from them.
	const lastKillWasMinibossRef = useRef(false);

	// Refs the interval callbacks read directly for mid-tick state visibility.
	// Mirrored after every commit by the layout effect below (refs can't be
	// written during render). Layout effects run before any timer callback or
	// passive effect can read them, and these timer-driven updates render and
	// commit in one task, so readers see what a render-time write gave them.
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
		cancelAmbush,
		setCampSource,
		rollSpawnRarity,
		recordSpawn,
		calmariaElapsedMs,
		...schedule
	} = useEncounterSchedule({
		active,
		encounterPlan,
		serverCampThresholdsMs,
		// During warmup the calmaria ticker runs so the time bar fills to show
		// progress. Once warmup is done (gauntlet phase), isSearching goes
		// false so the ticker stops — the gauntlet drives its own spawns.
		isSearching: state === "searching" && (!bossNode || warmupActive),
		postMinibossPauseRef: lastKillWasMinibossRef,
		onCampTriggered: (thresholdIndex) => {
			if (bossNode) return;
			stateRef.current = "acampamento";
			setState("acampamento");
			// Persist the camp claim server-side so phase-derived bag mutations
			// (pickFromBag / discardFromBag / exitZone) accept the camp tier
			// for this visit. The server validates the time threshold; if the
			// call rejects (e.g. clock drift past the grace window) we still
			// keep the cinematic on-screen and let the player retreat — the
			// 30% cap will apply in that edge case, which is the safe default.
			enterCamp({ characterId, thresholdIndex }).catch(() => {});
		},
	});

	// ── Boss-node warmup → gauntlet transition ──
	// When the calmaria budget fills during warmup, the encounter schedule's
	// `rollSpawnRarity()` returns "rare" (bar-fill = miniboss in regular
	// zones). For boss nodes we intercept that: instead of spawning a rare
	// from the schedule, we flip to gauntlet mode and let the gauntlet
	// spawner handle it.
	// `warmupDone` is a latch (it stays true after the bar resets), so it
	// can't be derived; it's set during render the moment the bar fills.
	const warmupBudgetMs = (bossNode?.warmupSeconds ?? 0) * 1000;
	if (
		bossNode &&
		!warmupDone &&
		warmupBudgetMs > 0 &&
		calmariaElapsedMs >= warmupBudgetMs
	) {
		setWarmupDone(true);
	}

	// The tick's two server calls, bound to this character. Stable across
	// renders (the session-wrapped mutations are), so the tick's
	// deactivation effect doesn't re-run on every combat frame.
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
	// The tick's vitals hooks, read by `resolveKill` (created before the tick
	// hook, which takes it as a parameter). Mirrored by a layout effect below.
	const vitalsForKillRef = useRef<() => Vitals | null>(NO_VITALS);
	const forgetSyncedVitalsRef = useRef<() => void>(NOOP);

	const resolveKill = useCallback(
		(killed: Enemy) => {
			const xpGained = killed.scaled.xpReward;
			stateRef.current = "victory";
			setLastKill({ xp: xpGained, potion: false });
			setState("victory");
			playKillSfx(killed);
			// Three kill categories produce 100%-retention pauses:
			// (1) zone miniboss (rare in combat zone) → miniboss_victory modal
			// (2) act boss (unique) → boss_victory cinematic (retreat only)
			// Gauntlet rares (rare in boss zone) advance the gauntlet, no pause.
			const inBossNode = bossNode != null;
			const isMinibossKill = killed.rarity === "rare" && !inBossNode;
			const isBossKill = killed.rarity === "unique";
			lastKillWasMinibossRef.current = isMinibossKill || isBossKill;
			if (isMinibossKill) {
				resetForMiniboss();
			}
			// The HP sync rides on the kill (one row written instead of two).
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
						// Server-authoritative — kills the race between this await and
						// the cache update that re-renders `stats` (closing over stale
						// `stats` would set HP to oldMax = newMax - 10).
						restoreToFullRef.current(result.newMaxLife);
						barrierApi.restoreToFull(result.newMaxBarrier);
					}
					if (result.potionDropped) {
						setLastKill({ xp: xpGained, potion: true });
					}
				} catch {
					// Fire-and-forget: a rejected kill record leaves local state as
					// is; the next periodic sync sends the vitals it carried.
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

	// ── Zone visit start ──
	// Called by the route on zone entry; `active` only pauses and resumes a
	// visit (the exit modal). The entered node's plan and boss config are
	// arguments because this render's props can still be the previous node's.
	const startVisit = useCallback(
		(plan: ZoneEncounterPlan, nextBossNode: BossNodeConfig | null) => {
			pendingIncenseRef.current = false;
			// Left set by a miniboss kill mid-victory-pause, it would hold the
			// next visit's time bar forever (the ticker skips while it's set).
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
			startScheduleVisit(plan);
			startTickVisit();
		},
		[startScheduleVisit, startTickVisit],
	);

	// Player chose "Seguir em frente" on the camp modal. Resume the loop.
	// Server-side `inCamp` flips back to false via exitCamp so the bag-cap
	// derivation returns to the 30% combat tier.
	const dismissCamp = useCallback(() => {
		if (stateRef.current !== "acampamento") return;
		stateRef.current = "searching";
		setState("searching");
		exitCampMutation({ characterId }).catch(() => {});
	}, [characterId, exitCampMutation]);

	// Player activated Incenso Etéreo. The gameplay rules (see CONTEXT.md →
	// Active player input → Incenso Etéreo) gate this:
	//   - blocked during a rare-miniboss fight, boss intro, while already
	//     in camp, or during an active ambush pack (the button is also
	//     disabled in the HUD, but enforce here too so a keyboard shortcut
	//     can't bypass it);
	//   - immediate during "searching" / "victory" (next spawn skipped);
	//   - queued during "engaged" against a non-rare mob.
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
		// Ambush packs commit you to the burst — incense must wait until the
		// last mob falls.
		if (isAmbushPackActive()) return;

		// The mutation decrements the cached count optimistically; we only
		// need to swallow the rejection.
		consumeIncense({ characterId }).catch(() => {});

		if (s === "engaged") {
			// Let the current fight resolve. The victory branch reads this and
			// routes to acampamento instead of the next spawn.
			pendingIncenseRef.current = true;
			return;
		}
		// Searching / victory — interrupt the next spawn and enter camp now.
		// Cancels any in-flight ambush pack per CONTEXT.md → Incenso Etéreo
		// ("the remaining mobs in the ambush pack do NOT spawn").
		cancelAmbush();
		setCampSource("incense");
		stateRef.current = "acampamento";
		setState("acampamento");
		// Persist the camp claim server-side so the bag mutations see the
		// camp phase. Incense camps bypass the time-threshold gate.
		enterCampViaIncense({ characterId }).catch(() => {});
	}, [
		characterId,
		consumeIncense,
		enterCampViaIncense,
		incense,
		isAmbushPackActive,
		cancelAmbush,
		setCampSource,
	]);

	// Shared mob-spawning pipeline: pick → find → scale → mod → Enemy.
	// Used by the regular spawn path and the gauntlet rare path.
	function spawnMob(
		pool: readonly MonsterId[],
		rarity: MonsterRarity,
	): Enemy | null {
		const pick = pickRandom(pool);
		if (!pick) return null;
		const def = findMonster(pick);
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
				primary: Math.random(),
				secondary: Math.random(),
				epithet: Math.random(),
			},
		};
	}

	function commitEnemy(e: Enemy) {
		enemyRef.current = e;
		setEnemy(e);
	}

	// ── Search delay → spawn enemy ──
	useDelay(
		active && state === "searching" && (!bossNode || warmupActive),
		schedule.nextSpawnGapMs,
		() => {
			const rarity = warmupActive ? rollMonsterRarity() : rollSpawnRarity();
			const e = spawnMob(monsterPool, rarity);
			if (!e) return;
			commitEnemy(e);
			recordSpawn();
			if (rarity === "rare") {
				setRareIntroStage("sprite");
				stateRef.current = "rare_intro";
				setState("rare_intro");
			} else {
				setRareIntroStage(null);
				stateRef.current = "engaged";
				setState("engaged");
			}
		},
	);

	// ── Boss-node gauntlet spawner ──
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
			// Entry roar plays as the sprite stage begins, so it lands WHILE the
			// boss materializes; the screenshake follows at the impact beat
			// (CombatScene) for a two-phase buildup.
			const bossConfig = getBossConfig(bossEnemy);
			if (bossConfig) playSfx(bossConfig.cinematic.entrySfx, { volume: 0.8 });
		},
	);

	// ── Intro cinematics → cascade into engaged ──
	// Spawning a rare sets state "rare_intro" + stage "sprite"; a boss sets
	// "boss_intro" + "sprite". Each stage holds for its entry in the shared
	// table, the same for every boss. See CONTEXT.md → Boss Cinematic.
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
		BOSS_INTRO_STAGE_MS_DEFAULT,
		setBossIntroStage,
		engage,
	);

	// ── Victory pause → back to searching (or pause for miniboss modal) ──
	useDelay(active && state === "victory", VICTORY_DELAY_MS, () => {
		const killedEnemy = enemyRef.current;
		enemyRef.current = null;
		setEnemy(null);
		setLastKill(null);
		// Gauntlet rare kill — advance the gauntlet index so the next spawn
		// is the next rare (or the boss, once N rares fall). No miniboss
		// modal, no camp; the gauntlet rolls straight through.
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
			// Incenso queued during the fight — enter camp instead of the next
			// spawn. Cancels any in-flight ambush pack so the remaining mobs
			// don't fire after dismissCamp (per CONTEXT.md → Incenso Etéreo).
			// The incense was already consumed; persist the camp claim now
			// that the cinematic actually fires.
			pendingIncenseRef.current = false;
			cancelAmbush();
			setCampSource("incense");
			stateRef.current = "acampamento";
			setState("acampamento");
			enterCampViaIncense({ characterId }).catch(() => {});
		} else {
			setState("searching");
		}
	});

	// Retreat is handled by the existing active=false transition in the world view.
	// `recordKill` flipped server `inCamp=true` on the miniboss kill so the
	// implicit "miniboss victory" tier still grants 100% retention if the
	// player retreats. Continuing past the panel returns them to combat tier;
	// `exitCamp` clears the server flag so subsequent bag commits cap at 30%.
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
		events,
		lastKill,
		drinkPotion,
		triggerIncense,
		calmariaElapsedMs,
		calmariaBudgetMs: schedule.calmariaBudgetMs,
		campThresholdsMs: schedule.campThresholdsMs,
		dismissMinibossModal,
		startVisit,
		dismissCamp,
		phase: derivePhase(state),
	};
}
