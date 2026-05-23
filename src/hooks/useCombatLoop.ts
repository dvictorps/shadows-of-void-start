// ─────────────────────────────────────────────────────────────────────────────
//  Combat tick orchestrator. Drives the searching/engaged/victory state
//  machine for the active combat zone. Runs entirely on the client; the
//  server only sees the resulting recordKill / syncHp / usePotion mutations.
//
//  Lifecycle:
//    activation effect   → resets refs + state when `active` flips
//    search delay        → spawns an enemy after a per-zone-rolled gap
//                          (encounterPlan.gapBetweenSpawns)
//    engaged tick        → @ 50ms intervals: leech, barrier recovery,
//                          alternate-weapon swings, enemy swing, victory/death
//    victory delay       → clears the enemy after VICTORY_DELAY_MS (800ms),
//                          then loops back to searching
//    periodic HP sync    → writes back HP every 10s if it changed
//
//  Refs vs state:
//    Refs (ticker callbacks read these directly to avoid stale closures):
//      stateRef, enemyRef, playerProgressRef, enemyProgressRef, deadRef,
//      nextSwingIndexRef, barrierRef, leechRef, playerHpRef, lastSyncedHpRef,
//      initialHpRef, activeRef
//    State (drives re-renders):
//      state, enemy, playerHp, barrier, lastKill, events
//    Live-from-query (no local mirror — see Params.potions):
//      potions
//
//  Public mutations called: api.combat.{syncHp, recordKill, usePotion}
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	damageBarrier,
	makeBarrierState,
	rescaleBarrier,
	tickBarrierRecovery,
} from "#/game/combat/barrier";
import {
	type CombatPhase,
	POTION_HEAL_FRACTION,
} from "#/game/combat/constants";

export type { CombatPhase };
import {
	applyDamageToBarrierThenLife,
	rollEnemyAttack,
	rollPlayerSwing,
} from "#/game/combat/damage";
import type { LeechInstance } from "#/game/combat/leech";
import { createLeechInstance, tickLeechInstances } from "#/game/combat/leech";
import { rollMonsterLevel } from "#/game/loot/drops";
import {
	applyMonsterMods,
	findMonster,
	type MonsterDefinition,
	type MonsterId,
	type MonsterModId,
	type MonsterRarity,
	modCountForRarity,
	rollMonsterMods,
	rollMonsterRarity,
	type ScaledMonsterStats,
	scaleMonsterStats,
} from "#/game/monsters";
import { applyOverlevelPenalty } from "#/game/progression/levels";
import type { ComputedCharacterStats } from "#/game/stats/types";
import {
	type AmbushSchedule,
	rollAmbushSchedule,
	rollCampThresholdsMs,
	rollSpawnGapMs,
	type ZoneEncounterPlan,
} from "#/game/world/encounter-schedule";
import type { RareNameSeed } from "#/game/world/i18n";
import {
	applyCharacterDelta,
	findCharacter,
} from "#/lib/optimistic-character";
import { pickRandom } from "#/lib/rng";
import { playMonsterDeathSfx, playSfx } from "#/lib/sfx";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { type DamageEvent, useDamageEvents } from "./useDamageEvents";
import { useDelay } from "./useDelay";
import { useTicker } from "./useTicker";

type CombatState =
	| "searching"
	| "boss_intro"
	| "engaged"
	| "victory"
	| "miniboss_victory"
	| "acampamento";

function derivePhase(state: CombatState): CombatPhase {
	if (state === "searching") return "exploration";
	// Camp and post-miniboss share the 100% retention tier per
	// CONTEXT.md → Bag retention tiers ("Boss kill → 100%"). The
	// miniboss-victory panel pause is itself a safe banking moment: the
	// player either retreats with the full bag they just earned, or
	// continues hunting and gives up that safety until the next camp.
	if (state === "acampamento" || state === "miniboss_victory") return "camp";
	return "combat";
}

// Three-stage dramatic spawn for rare minibosses. The ticker stays paused
// (gated on state === "engaged") for the full intro, so the player can't
// pre-empt the build-up and the boss can't swing before its HP bar shows.
export type BossIntroStage = "sprite" | "name" | "hp" | null;

const BOSS_INTRO_STAGE_MS: Record<Exclude<BossIntroStage, null>, number> = {
	// Each value is how long the stage holds BEFORE advancing — so it must be
	// at least as long as the visual transition kicked off when the stage
	// becomes active. Sprite enters with scale 1.2 → 1.0 over ~700 ms, then
	// the nameplate fades + slides in over ~400 ms, then the HP bar.
	sprite: 750,
	name: 500,
	hp: 500,
};

export type Enemy = {
	def: MonsterDefinition;
	currentHp: number;
	level: number;
	rarity: MonsterRarity;
	mods: readonly MonsterModId[];
	scaled: ScaledMonsterStats;
	// Seeds for the rare proper-name generator. Sampled once on spawn so the
	// rare's name stays stable across re-renders and locale switches.
	// Non-rare spawns still carry the field (unused) to keep the shape narrow.
	nameSeed: RareNameSeed;
};

function defenderFromEnemy(enemy: Enemy) {
	return {
		armor: enemy.scaled.armor,
		evasion: enemy.scaled.evasion,
		accuracy: enemy.scaled.accuracy,
		level: enemy.level,
		resistances: enemy.scaled.resistances,
	};
}

export type { DamageEvent };

type Params = {
	characterId: Id<"characters">;
	// Character level — used for the optimistic XP popup so the on-screen
	// number matches what the server actually awards after the over-level
	// penalty.
	characterLevel: number;
	stats: ComputedCharacterStats;
	initialHp: number;
	// Live potion count from the character query. The hook does NOT keep a
	// local copy — drink + drop are both server-driven, and tracking the
	// number in two places lets concurrent mutations race ("drink ghost"
	// bug where a drop arrived during the drink and the local +1 from the
	// drop overwrote the optimistic -1 from the drink).
	potions: number;
	initialIncense: number;
	monsterPool: readonly MonsterId[];
	zoneLevel: number;
	encounterPlan: ZoneEncounterPlan;
	active: boolean;
	onPlayerDeath: () => void;
};

// Drives flavor-text selection in the camp cinematic — re-exported here so
// existing imports keep working; the canonical declaration lives in
// `#/game/world/types` because the i18n helper there also reads it.
import type { CampSource } from "#/game/world";
export type { CampSource };

const VICTORY_DELAY_MS = 800;
const TICK_INTERVAL_MS = 50;
// Calmaria ticker is intentionally coarser than the combat tick — the bar
// only needs visual smoothness, and the `transition duration-100` on the
// bar fill already covers the gap. Half the renders for the same look.
const CALMARIA_TICK_MS = 100;
// Periodic sync is insurance against a mid-combat refresh — the deactivation
// effect (retreat / view change) already flushes the latest HP synchronously
// on graceful exits. 10s of potential lost-on-refresh HP is the tradeoff for
// the call-volume reduction. Self-skips when HP hasn't changed since the
// last write, so idle players make zero calls regardless of this interval.
const HP_SYNC_INTERVAL_MS = 10000;

export function useCombatLoop({
	characterId,
	characterLevel,
	stats,
	initialHp,
	potions,
	initialIncense,
	monsterPool,
	zoneLevel,
	encounterPlan,
	active,
	onPlayerDeath,
}: Params) {
	const maxHp = stats.maxLife;
	// Stash for the ambush branches below — TS can't narrow through closures,
	// so the branches each guard on this directly. Reads stay in-bounds and
	// the helper avoids `?? <fallback>` patterns that would silently mask a
	// missing config value.
	const ambushPlan = encounterPlan.ambushes;
	const [state, setState] = useState<CombatState>("searching");
	const [bossIntroStage, setBossIntroStage] = useState<BossIntroStage>(null);
	const [enemy, setEnemy] = useState<Enemy | null>(null);
	const [playerHp, setPlayerHp] = useState(initialHp);
	const [barrier, setBarrier] = useState(() =>
		makeBarrierState(stats.maxBarrier),
	);
	const [incense, setIncense] = useState(initialIncense);
	// Source of the active camp (drives cinematic flavor text). Read by the
	// CampCinematic component to switch the line set.
	const [campSource, setCampSource] = useState<CampSource>("baked");
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
	const playerProgressRef = useRef(0);
	const enemyProgressRef = useRef(0);
	const deadRef = useRef(false);
	// Tracks which swing fires next when dual-wielding (index into stats.swings).
	const nextSwingIndexRef = useRef(0);
	const barrierRef = useRef(barrier);
	barrierRef.current = barrier;
	const leechRef = useRef<LeechInstance[]>([]);

	const initialHpRef = useRef(initialHp);
	initialHpRef.current = initialHp;
	const initialIncenseRef = useRef(initialIncense);
	initialIncenseRef.current = initialIncense;
	const playerHpRef = useRef(playerHp);
	playerHpRef.current = playerHp;
	const lastSyncedHpRef = useRef(initialHp);

	// Time-bar progress: cumulative out-of-combat (calmaria) ms. Ticks only
	// while state === "searching" — combat and camps pause it. When it hits
	// `calmariaBudgetSeconds * 1000`, the next spawn becomes the miniboss.
	// Client-only by design — leaving the zone restarts the progression
	// (per CONTEXT.md → Time Bar).
	const calmariaBudgetMs = encounterPlan.calmariaBudgetSeconds * 1000;
	const [calmariaElapsedMs, setCalmariaElapsedMs] = useState(0);
	const calmariaElapsedMsRef = useRef(0);
	calmariaElapsedMsRef.current = calmariaElapsedMs;

	// Camp thresholds (ms of cumulative calmaria) where the camp cinematic
	// fires. Rolled once per zone activation with jitter so the trigger
	// instant isn't perfectly decodable. The `nextCampIndexRef` advances
	// as each camp triggers — when it equals the array length, all camps
	// for this run are spent. State mirror so the bar can render markers
	// at each camp position; ref is what the ticker reads to avoid stale
	// closures.
	const [campThresholdsMs, setCampThresholdsMs] = useState<readonly number[]>(
		[],
	);
	const campThresholdsMsRef = useRef<readonly number[]>([]);
	const nextCampIndexRef = useRef(0);

	// Ambush schedule + active-pack counter. The schedule is rolled once per
	// zone activation (mirrors camps). `ambushPackRemainingRef` is the mobs
	// remaining in the active pack — when > 0, the next spawn rolls inside the
	// ambush (short gap + heavier magic chance). See CONTEXT.md → Ambush.
	const ambushScheduleRef = useRef<readonly AmbushSchedule[]>([]);
	const nextAmbushIndexRef = useRef(0);
	const ambushPackRemainingRef = useRef(0);
	// `ambushActive` re-renders the scene so it can flash an "Ambush!" cue.
	const [ambushActive, setAmbushActive] = useState(false);

	const syncHp = useMutation(api.combat.syncHp);
	const recordKill = useMutation(api.combat.recordKill);
	// Optimistic potion decrement lives on the mutation hook so the
	// localStore patch and the server mutation complete in lockstep —
	// no client-side state mirror is needed, and concurrent recordKill
	// drops can't race the drink.
	const consumePotion = useMutation(api.combat.usePotion).withOptimisticUpdate(
		(localStore, args) => {
			const char = findCharacter(localStore, args.characterId);
			if (!char) return;
			applyCharacterDelta(localStore, args.characterId, {
				potions: Math.max(0, (char.potions ?? 0) - 1),
			});
		},
	);
	const consumeIncense = useMutation(api.combat.useEtherealIncense);

	// Optimistic XP popup mounts immediately; potion drop is patched in once the
	// server replies. Shared between player-swing kills and thorns-reflect kills.
	// The penalty is applied client-side too so the popup matches what the
	// server will award (no mid-flight number swap).
	const resolveKill = useCallback(
		(killed: Enemy) => {
			const xpGained = applyOverlevelPenalty(
				killed.scaled.xpReward,
				characterLevel,
				killed.level,
			);
			stateRef.current = "victory";
			setLastKill({ xp: xpGained, potion: false });
			setState("victory");
			playMonsterDeathSfx(killed.def.id);
			lastKillWasMinibossRef.current = killed.rarity === "rare";
			if (killed.rarity === "rare") {
				calmariaElapsedMsRef.current = 0;
				setCalmariaElapsedMs(0);
				// Re-roll camps + ambushes so the farming loop gets fresh
				// thresholds — player who kept going after the miniboss
				// should still get the rhythm of camps and surprise packs.
				const freshCamps = rollCampThresholdsMs(encounterPlan);
				campThresholdsMsRef.current = freshCamps;
				setCampThresholdsMs(freshCamps);
				nextCampIndexRef.current = 0;
				ambushScheduleRef.current = rollAmbushSchedule(encounterPlan);
				nextAmbushIndexRef.current = 0;
				ambushPackRemainingRef.current = 0;
				setAmbushActive(false);
			}
			recordKill({
				characterId,
				monsterId: killed.def.id,
				monsterLevel: killed.level,
				monsterRarity: killed.rarity,
			})
				.then((result) => {
					if (result.potionDropped) {
						setLastKill({ xp: xpGained, potion: true });
						// No local increment — character.potions is the source of
						// truth and the Convex query refreshes when recordKill
						// commits. Mirroring locally created a race with usePotion
						// (the +1 could overwrite the optimistic -1 from a drink).
					}
					if (result.incenseDropped) {
						setIncense((i) => i + 1);
					}
				})
				.catch(() => {});
		},
		[characterId, characterLevel, recordKill],
	);

	// Keep barrier max in sync with the stat engine. Gear swaps mid-combat
	// rescale rather than reset to full.
	useEffect(() => {
		setBarrier((prev) => rescaleBarrier(prev, stats.maxBarrier));
	}, [stats.maxBarrier]);

	// ── Activation transitions ──
	const activeRef = useRef(active);
	useEffect(() => {
		const wasActive = activeRef.current;
		if (active && !wasActive) {
			playerHpRef.current = initialHpRef.current;
			setPlayerHp(initialHpRef.current);
			setIncense(initialIncenseRef.current);
			pendingIncenseRef.current = false;
			setCampSource("baked");
			lastSyncedHpRef.current = initialHpRef.current;
			deadRef.current = false;
			enemyRef.current = null;
			setEnemy(null);
			setLastKill(null);
			leechRef.current = [];
			nextSwingIndexRef.current = 0;
			// Time bar is client-only — fresh entry always starts at 0.
			calmariaElapsedMsRef.current = 0;
			setCalmariaElapsedMs(0);
			const freshCamps = rollCampThresholdsMs(encounterPlan);
			campThresholdsMsRef.current = freshCamps;
			setCampThresholdsMs(freshCamps);
			nextCampIndexRef.current = 0;
			ambushScheduleRef.current = rollAmbushSchedule(encounterPlan);
			nextAmbushIndexRef.current = 0;
			ambushPackRemainingRef.current = 0;
			setAmbushActive(false);
			setBossIntroStage(null);
			stateRef.current = "searching";
			setState("searching");
		} else if (!active && wasActive && !deadRef.current) {
			syncHp({ characterId, hpCurrent: playerHpRef.current }).catch(() => {});
			lastSyncedHpRef.current = playerHpRef.current;
		}
		activeRef.current = active;
	}, [active, characterId, syncHp]);

	// ── Calmaria ticker — drives the time bar ──
	// The post-miniboss flag holds the ticker through the victory→searching
	// transition so the drained bar doesn't gain a tick before reset commits.
	useTicker(
		active && state === "searching" && !lastKillWasMinibossRef.current,
		CALMARIA_TICK_MS,
		() => {
			const next = calmariaElapsedMsRef.current + CALMARIA_TICK_MS;
			calmariaElapsedMsRef.current = next;
			setCalmariaElapsedMs(next);

			// Camp fires only if the budget hasn't filled yet — at the budget
			// boundary the boss-spawn check wins on the next spawn instead.
			const nextCampThreshold =
				campThresholdsMsRef.current[nextCampIndexRef.current];
			if (
				nextCampThreshold !== undefined &&
				next >= nextCampThreshold &&
				next < calmariaBudgetMs
			) {
				nextCampIndexRef.current += 1;
				setCampSource("baked");
				stateRef.current = "acampamento";
				setState("acampamento");
				return;
			}

			// Ambush trigger — checked after camps so a co-located camp wins.
			// Setting `ambushPackRemainingRef` makes the next spawn(s) roll
			// inside the ambush pack until the counter drains.
			const nextAmbush =
				ambushScheduleRef.current[nextAmbushIndexRef.current];
			if (
				ambushPlan &&
				nextAmbush !== undefined &&
				next >= nextAmbush.thresholdMs &&
				next < calmariaBudgetMs &&
				ambushPackRemainingRef.current === 0
			) {
				nextAmbushIndexRef.current += 1;
				ambushPackRemainingRef.current = nextAmbush.packSize;
				setAmbushActive(true);
				// Collapse the search gap so the first ambush mob fires almost
				// immediately. Subsequent spawns use the in-pack gap (set
				// in the post-spawn block below).
				setNextSpawnGapMs(ambushPlan.gapWithinPackMs);
			}
		},
	);

	// Player chose "Seguir em frente" on the camp modal. Resume the loop.
	const dismissCamp = useCallback(() => {
		if (stateRef.current !== "acampamento") return;
		stateRef.current = "searching";
		setState("searching");
	}, []);

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
			s === "boss_intro" ||
			s === "acampamento" ||
			s === "miniboss_victory"
		)
			return;
		if (s === "engaged" && enemyRef.current?.rarity === "rare") return;
		// Ambush packs commit you to the burst — incense must wait until the
		// last mob falls. Reads the ref because the closure capture lags by
		// one render after the pack drains.
		if (ambushPackRemainingRef.current > 0) return;

		consumeIncense({ characterId })
			.then((result) => setIncense(result.etherealIncense))
			.catch(() => {});

		if (s === "engaged") {
			// Let the current fight resolve. The victory branch reads this and
			// routes to acampamento instead of the next spawn.
			pendingIncenseRef.current = true;
			return;
		}
		// Searching / victory — interrupt the next spawn and enter camp now.
		// Cancels any in-flight ambush pack per CONTEXT.md → Incenso Etéreo
		// ("the remaining mobs in the ambush pack do NOT spawn").
		ambushPackRemainingRef.current = 0;
		setAmbushActive(false);
		setCampSource("incense");
		stateRef.current = "acampamento";
		setState("acampamento");
	}, [characterId, consumeIncense, incense]);

	// ── Search delay → spawn enemy ──
	// Each entry into "searching" rolls a fresh calmaria duration from the
	// zone's encounter plan (`gapBetweenSpawns`). useDelay re-creates its
	// timer when delayMs changes, so the new value takes effect immediately
	// when state transitions back to "searching".
	const [nextSpawnGapMs, setNextSpawnGapMs] = useState(() =>
		rollSpawnGapMs(encounterPlan),
	);
	useEffect(() => {
		if (state === "searching") {
			// While an ambush pack is mid-burst, force the in-pack gap so the
			// next mob fires almost immediately. Otherwise roll the normal
			// range so the in-pack gap can't leak into post-pack searching.
			if (ambushPlan && ambushPackRemainingRef.current > 0) {
				setNextSpawnGapMs(ambushPlan.gapWithinPackMs);
			} else {
				setNextSpawnGapMs(rollSpawnGapMs(encounterPlan));
			}
		}
	}, [state, encounterPlan, ambushPlan]);

	useDelay(active && state === "searching", nextSpawnGapMs, () => {
		const pick = pickRandom(monsterPool);
		if (!pick) return;
		const def = findMonster(pick);
		if (!def) return;
		const level = rollMonsterLevel(zoneLevel);
		const baseScaled = scaleMonsterStats(def, level);
		// Time bar full → next spawn is the miniboss (rare). Ambush packs
		// can't reach the budget-fill check because the calmaria ticker stops
		// adding once `next < calmariaBudgetMs` no longer holds, so the boss
		// branch always wins at the boundary. See CONTEXT.md → Time Bar.
		const inAmbush = ambushPlan != null && ambushPackRemainingRef.current > 0;
		const rarity =
			calmariaElapsedMsRef.current >= calmariaBudgetMs
				? "rare"
				: inAmbush
					? Math.random() < ambushPlan.magicChance
						? "magic"
						: "normal"
					: rollMonsterRarity();
		const mods = rollMonsterMods(modCountForRarity(rarity));
		const scaled = applyMonsterMods(baseScaled, mods);
		const nameSeed: RareNameSeed = {
			primary: Math.random(),
			secondary: Math.random(),
			epithet: Math.random(),
		};
		const newEnemy: Enemy = {
			def,
			currentHp: scaled.hp,
			level,
			rarity,
			mods,
			scaled,
			nameSeed,
		};
		enemyRef.current = newEnemy;
		setEnemy(newEnemy);
		playerProgressRef.current = 0;
		enemyProgressRef.current = 0;
		nextSwingIndexRef.current = 0;
		// Consume a slot from the ambush pack — the post-victory effect
		// reads `ambushPackRemainingRef` to set the next searching gap.
		if (inAmbush) {
			ambushPackRemainingRef.current -= 1;
			if (ambushPackRemainingRef.current <= 0) setAmbushActive(false);
		}
		// Rare minibosses get a staged reveal (sprite → name → HP bar) before
		// combat starts. Regular spawns engage immediately.
		if (rarity === "rare") {
			setBossIntroStage("sprite");
			stateRef.current = "boss_intro";
			setState("boss_intro");
		} else {
			setBossIntroStage(null);
			stateRef.current = "engaged";
			setState("engaged");
		}
	});

	// ── Boss intro stages → cascade into engaged ──
	useDelay(
		active && state === "boss_intro" && bossIntroStage === "sprite",
		BOSS_INTRO_STAGE_MS.sprite,
		() => setBossIntroStage("name"),
	);
	useDelay(
		active && state === "boss_intro" && bossIntroStage === "name",
		BOSS_INTRO_STAGE_MS.name,
		() => setBossIntroStage("hp"),
	);
	useDelay(
		active && state === "boss_intro" && bossIntroStage === "hp",
		BOSS_INTRO_STAGE_MS.hp,
		() => {
			setBossIntroStage(null);
			stateRef.current = "engaged";
			setState("engaged");
		},
	);

	// ── Victory pause → back to searching (or pause for miniboss modal) ──
	useDelay(active && state === "victory", VICTORY_DELAY_MS, () => {
		enemyRef.current = null;
		setEnemy(null);
		setLastKill(null);
		if (lastKillWasMinibossRef.current) {
			lastKillWasMinibossRef.current = false;
			stateRef.current = "miniboss_victory";
			setState("miniboss_victory");
		} else if (pendingIncenseRef.current) {
			// Incenso queued during the fight — enter camp instead of the next
			// spawn. Cancels any in-flight ambush pack so the remaining mobs
			// don't fire after dismissCamp (per CONTEXT.md → Incenso Etéreo).
			pendingIncenseRef.current = false;
			ambushPackRemainingRef.current = 0;
			setAmbushActive(false);
			setCampSource("incense");
			stateRef.current = "acampamento";
			setState("acampamento");
		} else {
			setState("searching");
		}
	});

	// Retreat is handled by the existing active=false transition in the world view.
	const dismissMinibossModal = useCallback(() => {
		if (stateRef.current !== "miniboss_victory") return;
		stateRef.current = "searching";
		setState("searching");
	}, []);

	// ── Engaged tick ──
	const enemyDef = enemy?.def ?? null;
	const enemyAttackSpeed = enemy?.scaled.attackSpeed ?? 1;
	const tickRate = stats.tickRate || 1;
	const hasSwings = stats.swings.length > 0;

	useTicker(
		active && state === "engaged" && enemyDef !== null,
		TICK_INTERVAL_MS,
		() => {
			if (stateRef.current !== "engaged" || deadRef.current) return;
			const currentEnemy = enemyRef.current;
			if (!currentEnemy || currentEnemy.currentHp <= 0) return;

			const dt = TICK_INTERVAL_MS / 1000;

			// Leech ticks every frame regardless of swing timing.
			if (leechRef.current.length > 0) {
				const { healed, instances } = tickLeechInstances(
					leechRef.current,
					dt,
					maxHp,
				);
				leechRef.current = instances;
				if (healed > 0 && !deadRef.current) {
					const next = Math.min(maxHp, playerHpRef.current + healed);
					if (next !== playerHpRef.current) {
						playerHpRef.current = next;
						setPlayerHp(next);
					}
				}
			}

			// Barrier recovery timer ticks too.
			if (
				barrierRef.current.recoveryRemaining !== null &&
				barrierRef.current.recoveryRemaining > 0
			) {
				const next = tickBarrierRecovery(barrierRef.current, dt);
				if (next !== barrierRef.current) {
					barrierRef.current = next;
					setBarrier(next);
				}
			}

			playerProgressRef.current += dt * tickRate;
			enemyProgressRef.current += dt * enemyAttackSpeed;

			const playerSwing = playerProgressRef.current >= 1 && hasSwings;
			if (playerSwing) playerProgressRef.current -= 1;
			const enemySwing = enemyProgressRef.current >= 1;
			if (enemySwing) enemyProgressRef.current -= 1;

			if (playerSwing) {
				const swingIndex = nextSwingIndexRef.current % stats.swings.length;
				const swing = stats.swings[swingIndex];
				nextSwingIndexRef.current =
					(nextSwingIndexRef.current + 1) % stats.swings.length;

				const result = rollPlayerSwing({
					swing,
					stats,
					defender: defenderFromEnemy(currentEnemy),
				});

				if (!result.isMiss && result.amount > 0) {
					const newEnemyHp = Math.max(
						0,
						currentEnemy.currentHp - result.amount,
					);
					const updated = { ...currentEnemy, currentHp: newEnemyHp };
					enemyRef.current = updated;
					setEnemy(updated);
					pushEvent({
						amount: result.amount,
						target: "enemy",
						isCrit: result.isCrit,
						weaponType: swing.weaponType,
					});
					playSfx("hit.wav", {
						volume: 0.3,
						pitchVariance: 0.1,
						exclusive: true,
					});

					// Spawn a leech instance based on the physical chunk landed.
					// (For MVP we leech on physical only; elemental leech is a future
					// mod.) Apply globally regardless of which weapon swung.
					const leechSrc = result.breakdown.physical;
					if (stats.lifeLeechPercent > 0 && leechSrc > 0) {
						const inst = createLeechInstance(leechSrc, stats.lifeLeechPercent);
						if (inst) leechRef.current.push(inst);
					}

					// Life-on-hit triggers per landed hit.
					if (stats.lifeGainOnHit > 0 && !deadRef.current) {
						const next = Math.min(
							maxHp,
							playerHpRef.current + stats.lifeGainOnHit,
						);
						if (next !== playerHpRef.current) {
							playerHpRef.current = next;
							setPlayerHp(next);
						}
					}

					if (newEnemyHp <= 0) {
						resolveKill(currentEnemy);
						return;
					}
				} else {
					pushEvent({
						amount: 0,
						target: "enemy",
						isCrit: false,
						isMiss: true,
					});
					playSfx("errarHit.wav", {
						volume: 0.25,
						pitchVariance: 0.1,
						exclusive: true,
					});
				}
			}

			if (enemySwing) {
				const attack = rollEnemyAttack({
					enemyAccuracy: currentEnemy.scaled.accuracy,
					physicalDamage: currentEnemy.scaled.physicalDamage,
					elementalDamage: currentEnemy.scaled.elementalDamage,
					defender: {
						armor: stats.armor,
						evasion: stats.evasion,
						accuracy: stats.accuracy,
						level: currentEnemy.level,
						resistances: stats.resistances,
						blockChance: stats.blockChance,
					},
				});
				if (attack.isMiss) {
					pushEvent({ amount: 0, target: "player", isMiss: true });
					playSfx("esquiva.wav", {
						volume: 0.5,
						pitchVariance: 0.1,
						exclusive: true,
					});
				} else if (attack.isBlocked) {
					// Block → no damage to barrier/life, but the hit still "lands" for
					// thorns purposes (handled below).
					pushEvent({ amount: 0, target: "player", isBlocked: true });
					playSfx("block.wav", {
						volume: 0.5,
						pitchVariance: 0.1,
						exclusive: true,
					});
				} else if (attack.amount > 0) {
					// Apply to barrier first, then life.
					const { state: nextBarrier, lifeOverflow } = damageBarrier(
						barrierRef.current,
						attack.amount,
					);
					barrierRef.current = nextBarrier;
					setBarrier(nextBarrier);

					const result = applyDamageToBarrierThenLife(
						lifeOverflow,
						0,
						playerHpRef.current,
					);
					playerHpRef.current = result.newLife;
					setPlayerHp(result.newLife);
					pushEvent({ amount: attack.amount, target: "player" });
					playSfx("tomandoHit.wav", {
						volume: 0.3,
						pitchVariance: 0.1,
						exclusive: true,
					});

					if (result.newLife <= 0 && !deadRef.current) {
						deadRef.current = true;
						playSfx("morte.wav");
						queueMicrotask(() => onPlayerDeath());
					}
				}

				// Thorns — reflects on any landed hit (block included), not on miss.
				// Per CONTEXT.md → Defenses → Block: "Thorns still reflect to the
				// attacker on block." If reflection kills the enemy, fall through to
				// the same victory branch the player-swing uses.
				if (!attack.isMiss && stats.thorns > 0 && !deadRef.current) {
					const reflected = Math.max(1, Math.floor(stats.thorns));
					const enemyAfter = Math.max(0, currentEnemy.currentHp - reflected);
					const updated = { ...currentEnemy, currentHp: enemyAfter };
					enemyRef.current = updated;
					setEnemy(updated);
					pushEvent({
						amount: reflected,
						target: "enemy",
						isThorns: true,
					});
					if (enemyAfter <= 0) {
						resolveKill(currentEnemy);
					}
				}
			}
		},
	);

	// ── Periodic HP sync ──
	useTicker(active, HP_SYNC_INTERVAL_MS, () => {
		if (deadRef.current) return;
		const hp = playerHpRef.current;
		if (hp === lastSyncedHpRef.current) return;
		lastSyncedHpRef.current = hp;
		syncHp({ characterId, hpCurrent: hp }).catch(() => {
			lastSyncedHpRef.current = -1;
		});
	});

	const usePotion = useCallback(async () => {
		if (potions <= 0 || playerHp >= maxHp) return;
		const prevHp = playerHpRef.current;
		const heal = Math.floor(maxHp * POTION_HEAL_FRACTION);
		const optimisticHp = Math.min(maxHp, prevHp + heal);
		const appliedHeal = optimisticHp - prevHp;
		playerHpRef.current = optimisticHp;
		setPlayerHp(optimisticHp);
		lastSyncedHpRef.current = optimisticHp;
		// HP is local-only (hook state), so the optimistic update is done
		// here. Potion count comes from the Convex character query, and
		// `consumePotion` is wrapped with `.withOptimisticUpdate` in the
		// parent so the localStore decrement is in lockstep with the
		// mutation completion — eliminating the race with concurrent
		// `recordKill` drops.
		try {
			await consumePotion({ characterId });
		} catch {
			const reverted = Math.max(0, playerHpRef.current - appliedHeal);
			playerHpRef.current = reverted;
			setPlayerHp(reverted);
			lastSyncedHpRef.current = -1;
		}
	}, [potions, playerHp, maxHp, characterId, consumePotion]);

	const barrierSnapshot = useMemo(
		() => ({
			current: barrier.current,
			max: barrier.max,
			recoveryRemaining: barrier.recoveryRemaining,
		}),
		[barrier.current, barrier.max, barrier.recoveryRemaining],
	);

	return {
		state,
		bossIntroStage,
		enemy,
		playerHp,
		barrier: barrierSnapshot,
		potions,
		incense,
		campSource,
		ambushActive,
		events,
		lastKill,
		usePotion,
		triggerIncense,
		calmariaElapsedMs,
		calmariaBudgetMs,
		campThresholdsMs,
		dismissMinibossModal,
		dismissCamp,
		phase: derivePhase(state),
	};
}
