// ─────────────────────────────────────────────────────────────────────────────
//  Engaged-state combat loop: 50ms tick + 10s periodic HP sync + the potion
//  consumable. Owns player vitals (HP, barrier, leech, dead) — the
//  orchestrator hands in the state machine's `state` + `enemy` and the
//  `resolveKill` callback that handles state transitions on death.
//
//  Damage flow per tick:
//    leech heal → barrier recovery → player swing → enemy swing → thorns
//
//  Server calls (injected by useCombatLoop, see useCombatMutations):
//    - drinkPotion (consumePotion, optimistic decrement on the mutation)
//    - HP sync ticker (syncVitals 10s after the last write when hp changed;
//      gated on deadRef). A kill carries the vitals itself (`vitalsForKill`),
//      which restarts that 10s window
//    - deactivation (syncVitals flush, only when not dead)
// ─────────────────────────────────────────────────────────────────────────────

import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

import {
	type BarrierState,
	damageBarrier,
	makeBarrierState,
	tickBarrier,
} from "#/game/combat/barrier";
import { POTION_HEAL_FRACTION } from "#/game/combat/constants";
import {
	applyDamageToBarrierThenLife,
	rollEnemyAttack,
	rollPlayerSwing,
} from "#/game/combat/damage";
import type { LeechInstance } from "#/game/combat/leech";
import { createLeechInstance, tickLeechInstances } from "#/game/combat/leech";
import type { Enemy } from "#/game/combat/types";
import type { ComputedCharacterStats } from "#/game/stats/types";
import { playPlayerSwingSfx, playSfx } from "#/lib/sfx";

import type { BarrierApi } from "./useBarrier";
import type { DamageEvent } from "./useDamageEvents";
import { useTicker } from "./useTicker";

const TICK_INTERVAL_MS = 50;
// Periodic sync is insurance against a mid-combat refresh — the deactivation
// effect (retreat / view change) already flushes the latest HP on graceful
// exits, and every kill carries the vitals too. 10s of potential
// lost-on-refresh HP is the tradeoff for the write-quota saving. Measured
// from the last write (a kill or a sync), so steady fighting never syncs on
// its own; it also self-skips when HP hasn't changed, so idle players make
// zero calls.
const HP_SYNC_INTERVAL_MS = 10000;
// How often the ticker checks whether that window has passed.
const HP_SYNC_CHECK_MS = 1000;

export interface Vitals {
	hpCurrent: number;
	barrierCurrent: number;
}

type Params = {
	active: boolean;
	// True only when state === "engaged" — the tick gate. The state machine
	// passes its current state so the tick can stop firing during boss intro
	// / victory / acampamento.
	isEngaged: boolean;
	enemy: Enemy | null;
	stats: ComputedCharacterStats;
	initialHp: number;
	potions: number;
	barrierApi: BarrierApi;
	onPlayerDeath: () => void;
	// Reset to "victory" by resolveKill before this returns — used by the
	// tick to fall through after a player-swing kill or thorns-reflect kill.
	resolveKill: (killed: Enemy) => void;
	pushEvent: (event: Omit<DamageEvent, "id">) => void;
	// Mutates `enemy` when a swing connects (mid-tick HP write). The state
	// machine's enemy ref is the source of truth.
	updateEnemy: (next: Enemy) => void;
	// Server calls, injected so the hook needs no transport (tests pass
	// no-ops). Both reject when the server refuses.
	syncVitals: (vitals: Vitals) => Promise<void>;
	consumePotion: (clientHp: number) => Promise<void>;
	// Dice rolls and audio. Production uses the defaults; tests inject
	// deterministic rolls and silent audio instead of mocking modules.
	deps?: CombatTickDeps;
};

export interface CombatTickDeps {
	rollPlayerSwing: typeof rollPlayerSwing;
	rollEnemyAttack: typeof rollEnemyAttack;
	playSfx: typeof playSfx;
	playPlayerSwingSfx: typeof playPlayerSwingSfx;
}

const DEFAULT_COMBAT_TICK_DEPS = {
	rollPlayerSwing,
	rollEnemyAttack,
	playSfx,
	playPlayerSwingSfx,
} satisfies CombatTickDeps;

export function useCombatTick({
	active,
	isEngaged,
	enemy,
	stats,
	initialHp,
	potions,
	barrierApi,
	onPlayerDeath,
	resolveKill,
	pushEvent,
	updateEnemy,
	syncVitals,
	consumePotion,
	deps = DEFAULT_COMBAT_TICK_DEPS,
}: Params) {
	const maxHp = stats.maxLife;

	const [playerHp, setPlayerHp] = useState(initialHp);

	const playerHpRef = useRef(playerHp);
	const initialHpRef = useRef(initialHp);
	const lastSyncedHpRef = useRef(initialHp);
	const lastSyncedBarrierRef = useRef(barrierApi.barrierRef.current.current);
	// Wall clock of the last vitals write (sync or kill); 0 = none yet.
	const lastSyncAtRef = useRef(0);
	const { barrierRef } = barrierApi;
	// Live barrier state for the engaged monster. Max comes from
	// `enemy.scaled.barrier` (0 unless `monsterAdditionalBarrier` rolled).
	// Reset on every fresh enemy spawn so the previous fight's cooldown
	// doesn't carry over.
	const enemyBarrierRef = useRef<BarrierState>(makeBarrierState(0));
	const leechRef = useRef<LeechInstance[]>([]);
	const leechHealAccRef = useRef(0);
	const lastLeechEventRef = useRef(0);
	const deadRef = useRef(false);
	// Fractional regen carry — lets sub-1 HP/s rates accumulate over multiple
	// ticks instead of being floored away. e.g. 0.5 HP/s + 100ms tick = 1 HP
	// every 2 seconds.
	const regenAccRef = useRef(0);

	// Mirror the `enemy` prop into a ref so the tick reads the live value
	// even if React hasn't committed a re-render between two consecutive
	// 50ms ticks. The orchestrator's `updateEnemy` callback syncs both the
	// state machine's enemyRef AND this one (we write here explicitly below)
	// so mid-tick HP updates from a player swing are visible to subsequent
	// reads in the same tick.
	const enemyRef = useRef<Enemy | null>(enemy);

	// Latest-value mirrors, synced after every commit. Refs can't be written
	// during render; a layout effect runs before any timer or passive effect
	// can read them, and render + commit of these timer-driven updates happen
	// in one task, so readers see the same values as with a render-time write.
	useLayoutEffect(() => {
		playerHpRef.current = playerHp;
		initialHpRef.current = initialHp;
		enemyRef.current = enemy;
	});

	// Combat-progress refs: how far each side is into its next swing (in
	// "swings", incremented by dt*rate per tick; ≥1 fires the swing).
	const playerProgressRef = useRef(0);
	const enemyProgressRef = useRef(0);
	// Index into stats.swings — advances modulo swings.length so dual-wield
	// alternates main / off hand.
	const nextSwingIndexRef = useRef(0);

	// Fresh spawn → reset progress refs so the first swing fires at the same
	// cadence as a from-zero fight. `scaled` identity is stable through a
	// single fight (damage swaps `currentHp` but keeps `scaled` by reference)
	// and changes only when a new monster is rolled. INVARIANT: every code
	// path that creates a new `Enemy` MUST allocate a fresh `scaled` object —
	// reusing or mutating in place would silently stop resetting swing
	// alternation across fights.
	//
	// The reset runs lazily at the top of the engaged tick (see
	// `resetForFreshFight`) rather than in an effect on `enemy.scaled`: every
	// ref it touches is only read inside that tick, so resetting just before
	// the first read of a new fight is equivalent.
	const fightScaledRef = useRef<Enemy["scaled"] | null>(null);
	const resetForFreshFight = (scaled: Enemy["scaled"]) => {
		fightScaledRef.current = scaled;
		playerProgressRef.current = 0;
		enemyProgressRef.current = 0;
		nextSwingIndexRef.current = 0;
		enemyBarrierRef.current = makeBarrierState(scaled.barrier);
		leechHealAccRef.current = 0;
		lastLeechEventRef.current = 0;
	};

	// A new zone visit (useCombatLoop.startVisit, on the zone-entry event):
	// HP from the character and fresh transient refs. Barrier lives in
	// useBarrier and persists across views — not reset here. Resuming the same
	// visit (`active` back after the exit modal's Cancel) resets nothing, so
	// the fight's HP carries on instead of snapping to the cached value.
	const startVisit = useCallback(() => {
		setPlayerHp(initialHpRef.current);
		playerHpRef.current = initialHpRef.current;
		lastSyncedHpRef.current = initialHpRef.current;
		lastSyncedBarrierRef.current = barrierRef.current.current;
		deadRef.current = false;
		leechRef.current = [];
		leechHealAccRef.current = 0;
		lastLeechEventRef.current = 0;
		nextSwingIndexRef.current = 0;
		regenAccRef.current = 0;
	}, [barrierRef]);

	// The deactivation HP sync stays in an effect: syncHp is a server call.
	const activeRef = useRef(active);
	useEffect(() => {
		const wasActive = activeRef.current;
		// Nothing to flush when the last kill or sync already carried them.
		const unsynced =
			playerHpRef.current !== lastSyncedHpRef.current ||
			barrierRef.current.current !== lastSyncedBarrierRef.current;
		// oxlint-disable-next-line you-might-not-need-an-effect/no-event-handler -- flushing HP to the server on deactivation is a sync with an external system; `active` flips from several route paths (retreat, death, travel, the exit modal opening), so there is no single handler to own it.
		if (!active && wasActive && !deadRef.current && unsynced) {
			syncVitals({
				hpCurrent: playerHpRef.current,
				barrierCurrent: barrierRef.current.current,
			}).catch(() => {});
			lastSyncedHpRef.current = playerHpRef.current;
			lastSyncedBarrierRef.current = barrierRef.current.current;
			lastSyncAtRef.current = Date.now();
		}
		activeRef.current = active;
	}, [active, syncVitals, barrierRef]);

	const enemyAttackSpeed = enemy?.scaled.attackSpeed ?? 1;
	const tickRate = stats.tickRate || 1;
	const hasSwings = stats.swings.length > 0;

	// Raises HP by up to `amount` (capped at max, nothing once dead) and
	// returns how much it actually healed.
	const healPlayer = (amount: number) => {
		if (amount <= 0 || deadRef.current) return 0;
		const next = Math.min(maxHp, playerHpRef.current + amount);
		const healed = next - playerHpRef.current;
		// Above max (a gear swap lowered it mid-fight) the gap is negative:
		// nothing heals, and the leech popup's sum mustn't shrink.
		if (healed <= 0) return 0;
		playerHpRef.current = next;
		setPlayerHp(next);
		return healed;
	};

	const applyHeal = (amount: number) => {
		const healed = healPlayer(amount);
		if (healed > 0) {
			pushEvent({ amount: healed, target: "player", isHealing: true });
		}
	};

	// Passive life regen — fires whenever the player is alive in combat
	// zones, in or out of engagement. Silent (no floating popup): regen is
	// the slow-fill bar pattern, not a damage event. Resets the fractional
	// accumulator when full or dead so a refill doesn't cash in stale credit.
	useTicker(active && stats.lifeRegen > 0, 100, () => {
		if (deadRef.current || playerHpRef.current >= maxHp) {
			regenAccRef.current = 0;
			return;
		}
		regenAccRef.current += stats.lifeRegen * 0.1;
		if (regenAccRef.current < 1) return;
		const whole = Math.floor(regenAccRef.current);
		regenAccRef.current -= whole;
		healPlayer(whole);
	});

	// Leech ticks every frame regardless of swing timing. Its heals add up
	// silently and show as one popup at most every 500ms.
	const tickLeech = (dt: number) => {
		if (leechRef.current.length === 0) return;
		const { healed, instances } = tickLeechInstances(
			leechRef.current,
			dt,
			maxHp,
		);
		leechRef.current = instances;
		if (healed <= 0 || deadRef.current) return;
		leechHealAccRef.current += healPlayer(healed);
		const now = Date.now();
		if (now - lastLeechEventRef.current < 500) return;
		const rounded = Math.round(leechHealAccRef.current);
		if (rounded > 0) {
			pushEvent({ amount: rounded, target: "player", isHealing: true });
		}
		leechHealAccRef.current = 0;
		lastLeechEventRef.current = now;
	};

	// Same mechanic on the enemy side when the monster has a barrier pool
	// (monsterAdditionalBarrier rolled). The live `current` floats only at
	// refill snap; the render gate avoids no-op updateEnemy calls.
	const tickEnemyBarrier = (currentEnemy: Enemy, dt: number) => {
		if (enemyBarrierRef.current.max <= 0) return;
		const nextEnemyBarrier = tickBarrier(enemyBarrierRef.current, dt);
		if (nextEnemyBarrier === enemyBarrierRef.current) return;
		enemyBarrierRef.current = nextEnemyBarrier;
		const displayed = Math.floor(currentEnemy.currentBarrier);
		const displayedNext = Math.floor(nextEnemyBarrier.current);
		if (displayedNext === displayed) return;
		const synced: Enemy = {
			...currentEnemy,
			currentBarrier: nextEnemyBarrier.current,
		};
		enemyRef.current = synced;
		updateEnemy(synced);
	};

	// Damage to the engaged monster: barrier first, life takes the overflow,
	// mirrored onto Enemy for the UI bar. The player swing and thorns share
	// it. Reads the live enemy ref, not the top-of-tick snapshot: an earlier
	// write in the same tick (barrier regen, a swing before thorns) would
	// otherwise be spread-clobbered.
	const applyDamageToEnemy = (amount: number, fallback: Enemy) => {
		const snapshot = enemyRef.current ?? fallback;
		let hpDamage = amount;
		if (enemyBarrierRef.current.current > 0) {
			const { state: nextEnemyBarrier, lifeOverflow } = damageBarrier(
				enemyBarrierRef.current,
				amount,
			);
			enemyBarrierRef.current = nextEnemyBarrier;
			hpDamage = lifeOverflow;
		}
		const updated: Enemy = {
			...snapshot,
			currentHp: Math.max(0, snapshot.currentHp - hpDamage),
			currentBarrier: enemyBarrierRef.current.current,
		};
		enemyRef.current = updated;
		updateEnemy(updated);
		return { updated, hpDamage };
	};

	// A swing or a reflection that drops the enemy to 0: life on kill, then
	// `resolveKill` (state → victory). True when it killed.
	const killIfDead = (updated: Enemy) => {
		if (updated.currentHp > 0) return false;
		applyHeal(stats.lifeOnKill);
		resolveKill(updated);
		return true;
	};

	// The player's swing, alternating main / off hand. True when it killed.
	const playerSwingTurn = (currentEnemy: Enemy) => {
		const swing = stats.swings[nextSwingIndexRef.current % stats.swings.length];
		nextSwingIndexRef.current =
			(nextSwingIndexRef.current + 1) % stats.swings.length;

		const result = deps.rollPlayerSwing({
			swing,
			stats,
			defender: {
				armor: currentEnemy.scaled.armor,
				evasion: currentEnemy.scaled.evasion,
				accuracy: currentEnemy.scaled.accuracy,
				level: currentEnemy.level,
				resistances: currentEnemy.scaled.resistances,
			},
		});

		if (result.isMiss || result.amount <= 0) {
			pushEvent({ amount: 0, target: "enemy", isCrit: false, isMiss: true });
			deps.playSfx("combat/errarHit.wav", {
				volume: 0.25,
				pitchVariance: 0.1,
				exclusive: true,
			});
			return false;
		}

		// Leech / life-on-hit feed off the raw hit amount — player power
		// doesn't drop because the target has a shield; the barrier just
		// delays HP loss.
		const { updated } = applyDamageToEnemy(result.amount, currentEnemy);
		pushEvent({
			amount: result.amount,
			target: "enemy",
			isCrit: result.isCrit,
			weaponType: swing.weaponType,
		});
		deps.playPlayerSwingSfx(swing.weaponType);

		// MVP: leech on physical only; elemental leech is a future mod.
		// Apply globally regardless of which weapon swung.
		const leechSrc = result.breakdown.physical;
		if (stats.lifeLeechPercent > 0 && leechSrc > 0) {
			const inst = createLeechInstance(leechSrc, stats.lifeLeechPercent);
			if (inst) leechRef.current.push(inst);
		}

		applyHeal(stats.lifeGainOnHit);
		return killIfDead(updated);
	};

	// A landed enemy hit: the barrier soaks first, life takes the overflow.
	const takeHit = (amount: number, isCrit: boolean) => {
		const { lifeOverflow } = barrierApi.applyDamage(amount);
		const { newLife } = applyDamageToBarrierThenLife(
			lifeOverflow,
			0,
			playerHpRef.current,
		);
		playerHpRef.current = newLife;
		setPlayerHp(newLife);
		pushEvent({ amount, target: "player", isCrit });
		deps.playSfx(isCrit ? "combat/critico.wav" : "combat/tomandoHit.wav", {
			volume: 0.3,
			pitchVariance: 0.1,
			exclusive: true,
		});

		if (newLife <= 0 && !deadRef.current) {
			deadRef.current = true;
			deps.playSfx("morte.wav");
			queueMicrotask(() => onPlayerDeath());
		}
	};

	// Per CONTEXT.md → Defenses → Block: thorns still reflect on block, not
	// on miss. A reflection kill takes the same victory path as a swing kill.
	const reflectThorns = (currentEnemy: Enemy) => {
		if (stats.thorns <= 0 || deadRef.current) return;
		const reflected = Math.max(1, Math.floor(stats.thorns));
		const { updated, hpDamage } = applyDamageToEnemy(reflected, currentEnemy);
		pushEvent({ amount: hpDamage, target: "enemy", isThorns: true });
		killIfDead(updated);
	};

	const enemySwingTurn = (currentEnemy: Enemy) => {
		const attack = deps.rollEnemyAttack({
			enemyAccuracy: currentEnemy.scaled.accuracy,
			physicalDamage: currentEnemy.scaled.physicalDamage,
			elementalDamage: currentEnemy.scaled.elementalDamage,
			enemyCriticalChance: currentEnemy.scaled.criticalChance,
			enemyCriticalMultiplier: currentEnemy.scaled.criticalMultiplier,
			enemyGainAsExtra: currentEnemy.scaled.gainAsExtraDamage,
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
			deps.playSfx("combat/esquiva.wav", {
				volume: 0.5,
				pitchVariance: 0.1,
				exclusive: true,
			});
			return;
		}
		if (attack.isBlocked) {
			// No damage to barrier/life, but the hit still "lands" for thorns.
			pushEvent({ amount: 0, target: "player", isBlocked: true });
			deps.playSfx("combat/block.wav", {
				volume: 0.5,
				pitchVariance: 0.1,
				exclusive: true,
			});
		} else if (attack.amount > 0) {
			takeHit(attack.amount, attack.isCrit);
		}
		reflectThorns(currentEnemy);
	};

	// Per tick: leech heal → enemy barrier recovery → player swing → enemy
	// swing → thorns. A player-swing kill ends the tick.
	useTicker(active && isEngaged && enemy !== null, TICK_INTERVAL_MS, () => {
		if (deadRef.current) return;
		const currentEnemy = enemyRef.current;
		if (!currentEnemy || currentEnemy.currentHp <= 0) return;
		if (fightScaledRef.current !== currentEnemy.scaled) {
			resetForFreshFight(currentEnemy.scaled);
		}

		const dt = TICK_INTERVAL_MS / 1000;
		tickLeech(dt);
		tickEnemyBarrier(currentEnemy, dt);

		playerProgressRef.current += dt * tickRate;
		enemyProgressRef.current += dt * enemyAttackSpeed;

		const playerSwing = playerProgressRef.current >= 1 && hasSwings;
		if (playerSwing) playerProgressRef.current -= 1;
		const enemySwing = enemyProgressRef.current >= 1;
		if (enemySwing) enemyProgressRef.current -= 1;

		if (playerSwing && playerSwingTurn(currentEnemy)) return;
		if (enemySwing) enemySwingTurn(currentEnemy);
	});

	// After a failed write, the next check re-sends the vitals.
	const forgetSyncedVitals = useCallback(() => {
		lastSyncedHpRef.current = -1;
		lastSyncedBarrierRef.current = -1;
	}, []);

	// Takes the current vitals for a write, marking them synced and
	// restarting the 10s window. `recordKill` carries them too (call
	// `forgetSyncedVitals` if the kill is rejected).
	const vitalsForKill = useCallback((): Vitals => {
		const vitals = {
			hpCurrent: playerHpRef.current,
			barrierCurrent: barrierRef.current.current,
		};
		lastSyncedHpRef.current = vitals.hpCurrent;
		lastSyncedBarrierRef.current = vitals.barrierCurrent;
		lastSyncAtRef.current = Date.now();
		return vitals;
	}, [barrierRef]);

	// Periodic HP + barrier sync — skips when neither has changed, or when a
	// write (usually a kill) went out less than 10s ago.
	useTicker(active, HP_SYNC_CHECK_MS, () => {
		if (deadRef.current) return;
		if (Date.now() - lastSyncAtRef.current < HP_SYNC_INTERVAL_MS) return;
		const hpChanged = playerHpRef.current !== lastSyncedHpRef.current;
		const brChanged =
			barrierRef.current.current !== lastSyncedBarrierRef.current;
		if (!hpChanged && !brChanged) return;
		syncVitals(vitalsForKill()).catch(forgetSyncedVitals);
	});

	// Guards read the ref so the callback identity is stable across combat
	// ticks (playerHp state changes every damage frame; including it in deps
	// would recreate the callback at 50ms cadence and invalidate any
	// downstream memoization).
	// Named `drinkPotion`, not `usePotion`: it's a plain async action, and a
	// `use*` name makes the hooks lint treat every caller as a hook call.
	const drinkPotion = useCallback(async () => {
		if (potions <= 0 || playerHpRef.current >= maxHp) return;
		const prevHp = playerHpRef.current;
		const heal = Math.floor(maxHp * POTION_HEAL_FRACTION);
		const optimisticHp = Math.min(maxHp, prevHp + heal);
		const appliedHeal = optimisticHp - prevHp;
		playerHpRef.current = optimisticHp;
		setPlayerHp(optimisticHp);
		lastSyncedHpRef.current = optimisticHp;
		// HP is local-only (hook state). The potion count comes from the
		// character query; `consumePotion` decrements it optimistically, so it
		// can't race a concurrent `recordKill` drop.
		try {
			await consumePotion(prevHp);
		} catch {
			const reverted = Math.max(0, playerHpRef.current - appliedHeal);
			playerHpRef.current = reverted;
			setPlayerHp(reverted);
			lastSyncedHpRef.current = -1;
		}
	}, [potions, maxHp, consumePotion]);

	// `overrideMaxHp` wins the race with the level-up's cache update. Barrier is the
	// caller's job (barrierApi.restoreToFull).
	const restoreToFull = useCallback(
		(overrideMaxHp?: number) => {
			const hp = overrideMaxHp ?? maxHp;
			playerHpRef.current = hp;
			setPlayerHp(hp);
			lastSyncedHpRef.current = hp;
			lastSyncedBarrierRef.current = barrierRef.current.current;
		},
		[maxHp, barrierRef],
	);

	return {
		playerHp,
		drinkPotion,
		restoreToFull,
		vitalsForKill,
		forgetSyncedVitals,
		startVisit,
	};
}

export type { BarrierState };
