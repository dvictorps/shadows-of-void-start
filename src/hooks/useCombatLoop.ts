// ─────────────────────────────────────────────────────────────────────────────
//  Combat orchestrator. Owns the state machine + spawn/victory delays + the
//  recordKill / incense mutations. Tick mechanics live in `useCombatTick`;
//  encounter scheduling in `useEncounterSchedule`.
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { findBoss } from "#/game/bosses";
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
import { applyCharacterDelta, applyCombatStateDelta, findCharacter } from "#/lib/optimistic-character";
import { pickRandom } from "#/lib/rng";
import { playKillSfx } from "#/lib/sfx";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useCombatTick } from "./useCombatTick";
import { type DamageEvent, useDamageEvents } from "./useDamageEvents";
import { useDelay } from "./useDelay";
import { useEncounterSchedule } from "./useEncounterSchedule";
import { useSessionToken } from "./useSessionToken";

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

type Params = {
	characterId: Id<"characters">;
	// Character level — used for the optimistic XP popup so the on-screen
	// number matches what the server actually awards after the over-level
	// penalty.
	characterLevel: number;
	stats: ComputedCharacterStats;
	initialHp: number;
	initialBarrier?: number;
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

export function useCombatLoop({
	characterId,
	characterLevel,
	stats,
	initialHp,
	initialBarrier,
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
	const [warmupDone, setWarmupDone] = useState(!bossNode?.warmupSeconds);
	// Boss-node gauntlet progress. 1..N = next gauntlet rare to spawn;
	// `null` while not in a boss node or once the gauntlet is exhausted
	// (boss next). Reset to 1 on every activation when bossNode is set.
	const [gauntletFightIndex, setGauntletFightIndex] = useState<number | null>(
		null,
	);
	// Set true when the player triggers incenso during "engaged" — the
	// post-victory transition reads this and routes to camp instead of
	// the next spawn. Cleared on activation reset and on consumption.
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
	const stateRef = useRef(state);
	stateRef.current = state;
	const enemyRef = useRef<Enemy | null>(enemy);
	enemyRef.current = enemy;

	const { withSession } = useSessionToken();

	const enterCamp = useMutation(api.combat.enterCamp);
	const exitCampMutation = useMutation(api.combat.exitCamp);
	const enterCampViaIncense = useMutation(api.combat.enterCampViaIncense);

	const warmupActive = !!bossNode && !warmupDone;

	const schedule = useEncounterSchedule({
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
			enterCamp(withSession({ characterId, thresholdIndex })).catch(() => {});
		},
	});

	const recordKill = useMutation(api.combat.recordKill);
	// Optimistic localStore patch keeps the incense counter in lockstep with
	// the mutation, so concurrent recordKill drops can't race the consume.
	// ── Boss-node warmup → gauntlet transition ──
	// When the calmaria budget fills during warmup, the encounter schedule's
	// `rollSpawnRarity()` returns "rare" (bar-fill = miniboss in regular
	// zones). For boss nodes we intercept that: instead of spawning a rare
	// from the schedule, we flip to gauntlet mode and let the gauntlet
	// spawner handle it.
	const warmupBudgetMs = (bossNode?.warmupSeconds ?? 0) * 1000;
	useEffect(() => {
		if (!bossNode || warmupDone || warmupBudgetMs <= 0) return;
		if (schedule.calmariaElapsedMs >= warmupBudgetMs) {
			setWarmupDone(true);
		}
	}, [bossNode, warmupDone, warmupBudgetMs, schedule.calmariaElapsedMs]);

	const consumeIncense = useMutation(
		api.combat.useEtherealIncense,
	).withOptimisticUpdate((localStore, args) => {
		const char = findCharacter(localStore, args.characterId);
		if (char) {
			applyCharacterDelta(localStore, args.characterId, {
				etherealIncense: Math.max(0, (char.etherealIncense ?? 0) - 1),
			});
		}
		const csData = localStore.getQuery(api.combatState.byCharacterId, { characterId: args.characterId });
		if (csData) {
			applyCombatStateDelta(localStore, args.characterId, {
				etherealIncense: Math.max(0, csData.etherealIncense - 1),
			});
		}
	});

	const updateEnemyForTick = useCallback((next: Enemy) => {
		enemyRef.current = next;
		setEnemy(next);
	}, []);

	// Latest stats mirrored into a ref so the post-recordKill .then handler
	// reads fresh maxLife/maxBarrier even when the closure was captured one
	// or more renders earlier (per Gemini review on PR #64).
	const statsRef = useRef(stats);
	statsRef.current = stats;

	const restoreToFullRef = useRef<
		(overrideMaxHp?: number, overrideMaxBarrier?: number) => void
	>(() => {});

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
				schedule.resetForMiniboss();
			}
			recordKill(
				withSession({
					characterId,
					monsterId: killed.def.id,
					monsterLevel: killed.level,
					monsterRarity: killed.rarity,
				}),
			)
				.then((result) => {
					if (result.levelsGained > 0) {
						// Read from statsRef, not the closed-over `stats` — the
						// closure was captured before the level-up bumped maxLife.
						restoreToFullRef.current(
							statsRef.current.maxLife,
							statsRef.current.maxBarrier,
						);
					}
					if (result.potionDropped) {
						setLastKill({ xp: xpGained, potion: true });
					}
				})
				.catch(() => {});
		},
		[
			characterId,
			characterLevel,
			recordKill,
			schedule.resetForMiniboss,
			withSession,
		],
	);

	const { playerHp, barrier, usePotion, restoreToFull } = useCombatTick({
		characterId,
		active,
		isEngaged: state === "engaged",
		enemy,
		stats,
		initialHp,
		initialBarrier,
		potions,
		onPlayerDeath,
		resolveKill,
		pushEvent,
		updateEnemy: updateEnemyForTick,
	});
	restoreToFullRef.current = restoreToFull;

	// ── Activation transitions ──
	const activeRef = useRef(active);
	useEffect(() => {
		if (active && !activeRef.current) {
			pendingIncenseRef.current = false;
			enemyRef.current = null;
			setEnemy(null);
			setLastKill(null);
			setRareIntroStage(null);
			setBossIntroStage(null);
			// Boss-node entry: reset warmup + gauntlet to fight 1.
			setWarmupDone(!bossNode?.warmupSeconds);
			setGauntletFightIndex(
				bossNode && bossNode.gauntlet.fights > 0 ? 1 : null,
			);
			stateRef.current = "searching";
			setState("searching");
		}
		activeRef.current = active;
	}, [active, bossNode]);

	// Player chose "Seguir em frente" on the camp modal. Resume the loop.
	// Server-side `inCamp` flips back to false via exitCamp so the bag-cap
	// derivation returns to the 30% combat tier.
	const dismissCamp = useCallback(() => {
		if (stateRef.current !== "acampamento") return;
		stateRef.current = "searching";
		setState("searching");
		exitCampMutation(withSession({ characterId })).catch(() => {});
	}, [characterId, exitCampMutation, withSession]);

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
		if (schedule.isAmbushPackActive()) return;

		// The optimistic update on the mutation hook handles the
		// localStore decrement; we only need to swallow the rejection.
		consumeIncense(withSession({ characterId })).catch(() => {});

		if (s === "engaged") {
			// Let the current fight resolve. The victory branch reads this and
			// routes to acampamento instead of the next spawn.
			pendingIncenseRef.current = true;
			return;
		}
		// Searching / victory — interrupt the next spawn and enter camp now.
		// Cancels any in-flight ambush pack per CONTEXT.md → Incenso Etéreo
		// ("the remaining mobs in the ambush pack do NOT spawn").
		schedule.cancelAmbush();
		schedule.setCampSource("incense");
		stateRef.current = "acampamento";
		setState("acampamento");
		// Persist the camp claim server-side so the bag mutations see the
		// camp phase. Incense camps bypass the time-threshold gate.
		enterCampViaIncense(withSession({ characterId })).catch(() => {});
	}, [
		characterId,
		consumeIncense,
		enterCampViaIncense,
		incense,
		schedule.isAmbushPackActive,
		schedule.cancelAmbush,
		schedule.setCampSource,
		withSession,
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
			const rarity = warmupActive
				? rollMonsterRarity()
				: schedule.rollSpawnRarity();
			const e = spawnMob(monsterPool, rarity);
			if (!e) return;
			commitEnemy(e);
			schedule.consumeAmbushSlot();
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
			commitEnemy({
				def: boss.template,
				currentHp: scaled.hp,
				currentBarrier: scaled.barrier,
				level: boss.level,
				rarity: "unique",
				mods: [],
				scaled,
				nameSeed: { primary: 0, secondary: 0, epithet: 0 },
			});
			setBossIntroStage("sprite");
			stateRef.current = "boss_intro";
			setState("boss_intro");
		},
	);

	// ── Rare intro stages → cascade into engaged ──
	useDelay(
		active && state === "rare_intro" && rareIntroStage === "sprite",
		RARE_INTRO_STAGE_MS.sprite,
		() => setRareIntroStage("name"),
	);
	useDelay(
		active && state === "rare_intro" && rareIntroStage === "name",
		RARE_INTRO_STAGE_MS.name,
		() => setRareIntroStage("hp"),
	);
	useDelay(
		active && state === "rare_intro" && rareIntroStage === "hp",
		RARE_INTRO_STAGE_MS.hp,
		() => {
			setRareIntroStage(null);
			stateRef.current = "engaged";
			setState("engaged");
		},
	);

	// ── Boss intro stages → cascade into engaged ──
	// The boss orchestrator (task #6) sets state === "boss_intro" + bossIntroStage
	// = "sprite" when spawning a boss. Per-boss `BossConfig.cinematic` overrides
	// the sprite + impact-beat timings; name + hp use the default constants so
	// every boss feels consistent at the end of the cascade.
	useDelay(
		active && state === "boss_intro" && bossIntroStage === "sprite",
		BOSS_INTRO_STAGE_MS_DEFAULT.sprite,
		() => setBossIntroStage("impact"),
	);
	useDelay(
		active && state === "boss_intro" && bossIntroStage === "impact",
		BOSS_INTRO_STAGE_MS_DEFAULT.impact,
		() => setBossIntroStage("name"),
	);
	useDelay(
		active && state === "boss_intro" && bossIntroStage === "name",
		BOSS_INTRO_STAGE_MS_DEFAULT.name,
		() => setBossIntroStage("hp"),
	);
	useDelay(
		active && state === "boss_intro" && bossIntroStage === "hp",
		BOSS_INTRO_STAGE_MS_DEFAULT.hp,
		() => {
			setBossIntroStage(null);
			stateRef.current = "engaged";
			setState("engaged");
		},
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
			schedule.cancelAmbush();
			schedule.setCampSource("incense");
			stateRef.current = "acampamento";
			setState("acampamento");
			enterCampViaIncense(withSession({ characterId })).catch(() => {});
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
		exitCampMutation(withSession({ characterId })).catch(() => {});
	}, [characterId, exitCampMutation, withSession]);

	return {
		state,
		rareIntroStage,
		bossIntroStage,
		enemy,
		playerHp,
		barrier: {
			current: barrier.current,
			max: barrier.max,
			refillRemaining: barrier.refillRemaining,
		},
		potions,
		incense,
		campSource: schedule.campSource,
		ambushActive: schedule.ambushActive,
		events,
		lastKill,
		usePotion,
		triggerIncense,
		calmariaElapsedMs: schedule.calmariaElapsedMs,
		calmariaBudgetMs: schedule.calmariaBudgetMs,
		campThresholdsMs: schedule.campThresholdsMs,
		dismissMinibossModal,
		dismissCamp,
		phase: derivePhase(state),
	};
}
