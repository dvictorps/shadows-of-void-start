// ─────────────────────────────────────────────────────────────────────────────
//  Engaged-state combat loop: 50ms tick + 10s periodic HP sync + the potion
//  consumable. Owns player vitals (HP, barrier, leech, dead) — the
//  orchestrator hands in the state machine's `state` + `enemy` and the
//  `resolveKill` callback that handles state transitions on death.
//
//  Damage flow per tick:
//    leech heal → barrier recovery → player swing → enemy swing → thorns
//
//  Mutations fire on:
//    - usePotion (consumePotion, optimistic decrement on the mutation hook)
//    - HP sync ticker (syncHp every 10s when hp changed; gated on deadRef)
//    - deactivation (syncHp flush, only when not dead)
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	type BarrierState,
	damageBarrier,
	makeBarrierState,
	rescaleBarrier,
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
import { applyCharacterDelta, findCharacter } from "#/lib/optimistic-character";
import { playPlayerSwingSfx, playSfx } from "#/lib/sfx";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { DamageEvent } from "./useDamageEvents";
import { useSessionToken } from "./useSessionToken";
import { useTicker } from "./useTicker";

const TICK_INTERVAL_MS = 50;
// Periodic sync is insurance against a mid-combat refresh — the deactivation
// effect (retreat / view change) already flushes the latest HP synchronously
// on graceful exits. 10s of potential lost-on-refresh HP is the tradeoff for
// the call-volume reduction. Self-skips when HP hasn't changed since the
// last write, so idle players make zero calls regardless of this interval.
const HP_SYNC_INTERVAL_MS = 10000;

type Params = {
	characterId: Id<"characters">;
	active: boolean;
	// True only when state === "engaged" — the tick gate. The state machine
	// passes its current state so the tick can stop firing during boss intro
	// / victory / acampamento.
	isEngaged: boolean;
	enemy: Enemy | null;
	stats: ComputedCharacterStats;
	initialHp: number;
	initialBarrier?: number;
	potions: number;
	onPlayerDeath: () => void;
	// Reset to "victory" by resolveKill before this returns — used by the
	// tick to fall through after a player-swing kill or thorns-reflect kill.
	resolveKill: (killed: Enemy) => void;
	pushEvent: (event: Omit<DamageEvent, "id">) => void;
	// Mutates `enemy` when a swing connects (mid-tick HP write). The state
	// machine's enemy ref is the source of truth.
	updateEnemy: (next: Enemy) => void;
};

export function useCombatTick({
	characterId,
	active,
	isEngaged,
	enemy,
	stats,
	initialHp,
	initialBarrier,
	potions,
	onPlayerDeath,
	resolveKill,
	pushEvent,
	updateEnemy,
}: Params) {
	const maxHp = stats.maxLife;

	const [playerHp, setPlayerHp] = useState(initialHp);
	const [barrier, setBarrier] = useState(() => {
		if (initialBarrier !== undefined && initialBarrier < stats.maxBarrier) {
			const s = makeBarrierState(stats.maxBarrier);
			s.current = initialBarrier;
			return s;
		}
		return makeBarrierState(stats.maxBarrier);
	});

	const playerHpRef = useRef(playerHp);
	playerHpRef.current = playerHp;
	const initialHpRef = useRef(initialHp);
	initialHpRef.current = initialHp;
	const lastSyncedHpRef = useRef(initialHp);
	const lastSyncedBarrierRef = useRef(initialBarrier ?? stats.maxBarrier);
	const barrierRef = useRef(barrier);
	barrierRef.current = barrier;
	// Live barrier state for the engaged monster. Max comes from
	// `enemy.scaled.barrier` (0 unless `monsterAdditionalBarrier` rolled).
	// Reset on every fresh enemy spawn so the previous fight's cooldown
	// doesn't carry over.
	const enemyBarrierRef = useRef<BarrierState>(makeBarrierState(0));
	const leechRef = useRef<LeechInstance[]>([]);
	const deadRef = useRef(false);

	// Mirror the `enemy` prop into a ref so the tick reads the live value
	// even if React hasn't committed a re-render between two consecutive
	// 50ms ticks. The orchestrator's `updateEnemy` callback syncs both the
	// state machine's enemyRef AND this one (we write here explicitly below)
	// so mid-tick HP updates from a player swing are visible to subsequent
	// reads in the same tick.
	const enemyRef = useRef<Enemy | null>(enemy);
	enemyRef.current = enemy;

	// Combat-progress refs: how far each side is into its next swing (in
	// "swings", incremented by dt*rate per tick; ≥1 fires the swing).
	const playerProgressRef = useRef(0);
	const enemyProgressRef = useRef(0);
	// Index into stats.swings — advances modulo swings.length so dual-wield
	// alternates main / off hand.
	const nextSwingIndexRef = useRef(0);

	const { withSession } = useSessionToken();

	const syncHp = useMutation(api.combat.syncHp);
	const consumePotion = useMutation(api.combat.usePotion).withOptimisticUpdate(
		(localStore, args) => {
			const char = findCharacter(localStore, args.characterId);
			if (!char) return;
			applyCharacterDelta(localStore, args.characterId, {
				potions: Math.max(0, (char.potions ?? 0) - 1),
			});
		},
	);

	// Keep barrier max in sync with the stat engine. Gear swaps mid-combat
	// rescale rather than reset to full.
	useEffect(() => {
		setBarrier((prev) => rescaleBarrier(prev, stats.maxBarrier));
	}, [stats.maxBarrier]);

	// Fresh spawn → reset progress refs so the first swing fires at the same
	// cadence as a from-zero fight. `scaled` identity is stable through a
	// single fight (damage swaps `currentHp` but keeps `scaled` by reference)
	// and changes only when a new monster is rolled. INVARIANT: every code
	// path that creates a new `Enemy` MUST allocate a fresh `scaled` object —
	// reusing or mutating in place would silently stop resetting swing
	// alternation across fights.
	const enemyScaled = enemy?.scaled;
	useEffect(() => {
		if (enemyScaled) {
			playerProgressRef.current = 0;
			enemyProgressRef.current = 0;
			nextSwingIndexRef.current = 0;
			enemyBarrierRef.current = makeBarrierState(enemyScaled.barrier);
		}
	}, [enemyScaled]);

	// Activation: reset vitals on zone entry. Deactivation: flush HP sync if
	// the player is alive (graceful retreat / view change).
	const activeRef = useRef(active);
	useEffect(() => {
		const wasActive = activeRef.current;
		if (active && !wasActive) {
			playerHpRef.current = initialHpRef.current;
			setPlayerHp(initialHpRef.current);
			lastSyncedHpRef.current = initialHpRef.current;
			lastSyncedBarrierRef.current = barrierRef.current.current;
			deadRef.current = false;
			leechRef.current = [];
			nextSwingIndexRef.current = 0;
		} else if (!active && wasActive && !deadRef.current) {
			syncHp(
				withSession({
					characterId,
					hpCurrent: playerHpRef.current,
					barrierCurrent: barrierRef.current.current,
				}),
			).catch(() => {});
			lastSyncedHpRef.current = playerHpRef.current;
			lastSyncedBarrierRef.current = barrierRef.current.current;
		}
		activeRef.current = active;
	}, [active, characterId, syncHp, withSession]);

	const enemyAttackSpeed = enemy?.scaled.attackSpeed ?? 1;
	const tickRate = stats.tickRate || 1;
	const hasSwings = stats.swings.length > 0;

	// Barrier ticks independently of combat — regen runs during calmaria too.
	useTicker(active && !isEngaged, 100, () => {
		const next = tickBarrier(barrierRef.current, 0.1);
		if (next !== barrierRef.current) {
			barrierRef.current = next;
			setBarrier(next);
		}
	});

	useTicker(active && isEngaged && enemy !== null, TICK_INTERVAL_MS, () => {
		if (deadRef.current) return;
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

		// Barrier ticks every frame: regen while above zero (5%/s of max),
		// cooldown countdown while below zero (10s after a break). See ADR 0005.
		const nextBarrier = tickBarrier(barrierRef.current, dt);
		if (nextBarrier !== barrierRef.current) {
			barrierRef.current = nextBarrier;
			setBarrier(nextBarrier);
		}

		// Same mechanic on the enemy side when the monster has a barrier pool
		// (monsterAdditionalBarrier rolled). The live `current` floats every
		// frame; the React render only fires when the displayed integer
		// changes — otherwise a regenerating barrier would push 20 no-op
		// updateEnemy calls per second.
		if (enemyBarrierRef.current.max > 0) {
			const nextEnemyBarrier = tickBarrier(enemyBarrierRef.current, dt);
			if (nextEnemyBarrier !== enemyBarrierRef.current) {
				enemyBarrierRef.current = nextEnemyBarrier;
				const displayed = Math.floor(currentEnemy.currentBarrier);
				const displayedNext = Math.floor(nextEnemyBarrier.current);
				if (displayedNext !== displayed) {
					const synced: Enemy = {
						...currentEnemy,
						currentBarrier: nextEnemyBarrier.current,
					};
					enemyRef.current = synced;
					updateEnemy(synced);
				}
			}
		}

		// Apply damage to the engaged monster: route through barrier first,
		// life takes the overflow, mirror onto Enemy for the UI bar. Used by
		// the player-swing branch and the thorns-reflect branch — both share
		// the same "barrier-first then HP" rule.
		const applyDamageToEnemy = (
			amount: number,
			snapshot: Enemy,
		): { updated: Enemy; hpDamage: number } => {
			let hpDamage = amount;
			if (enemyBarrierRef.current.current > 0) {
				const { state: nextEnemyBarrier, lifeOverflow } = damageBarrier(
					enemyBarrierRef.current,
					amount,
				);
				enemyBarrierRef.current = nextEnemyBarrier;
				hpDamage = lifeOverflow;
			}
			const newHp = Math.max(0, snapshot.currentHp - hpDamage);
			const updated: Enemy = {
				...snapshot,
				currentHp: newHp,
				currentBarrier: enemyBarrierRef.current.current,
			};
			enemyRef.current = updated;
			updateEnemy(updated);
			return { updated, hpDamage };
		};

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
				defender: {
					armor: currentEnemy.scaled.armor,
					evasion: currentEnemy.scaled.evasion,
					accuracy: currentEnemy.scaled.accuracy,
					level: currentEnemy.level,
					resistances: currentEnemy.scaled.resistances,
				},
			});

			if (!result.isMiss && result.amount > 0) {
				// Leech / life-on-hit downstream feed off the raw hit amount —
				// player power doesn't drop because the target has a shield;
				// the barrier just delays HP loss. Read from the live ref to
				// match the thorns branch — earlier in-tick writes (barrier
				// regen, future per-tick fields) wouldn't get spread-clobbered.
				const { updated } = applyDamageToEnemy(
					result.amount,
					enemyRef.current ?? currentEnemy,
				);
				pushEvent({
					amount: result.amount,
					target: "enemy",
					isCrit: result.isCrit,
					weaponType: swing.weaponType,
				});
				playPlayerSwingSfx(swing.weaponType);

				// MVP: leech on physical only; elemental leech is a future mod.
				// Apply globally regardless of which weapon swung.
				const leechSrc = result.breakdown.physical;
				if (stats.lifeLeechPercent > 0 && leechSrc > 0) {
					const inst = createLeechInstance(leechSrc, stats.lifeLeechPercent);
					if (inst) leechRef.current.push(inst);
				}

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

				if (updated.currentHp <= 0) {
					resolveKill(updated);
					return;
				}
			} else {
				pushEvent({
					amount: 0,
					target: "enemy",
					isCrit: false,
					isMiss: true,
				});
				playSfx("combat/errarHit.wav", {
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
				playSfx("combat/esquiva.wav", {
					volume: 0.5,
					pitchVariance: 0.1,
					exclusive: true,
				});
			} else if (attack.isBlocked) {
				// No damage to barrier/life, but the hit still "lands" for thorns.
				pushEvent({ amount: 0, target: "player", isBlocked: true });
				playSfx("combat/block.wav", {
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
				pushEvent({
					amount: attack.amount,
					target: "player",
					isCrit: attack.isCrit,
				});
				playSfx(attack.isCrit ? "combat/critico.wav" : "combat/tomandoHit.wav", {
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

			// Per CONTEXT.md → Defenses → Block: thorns still reflect on block.
			// Not on miss. If reflection kills, fall through to the same victory
			// branch the player-swing uses.
			if (!attack.isMiss && stats.thorns > 0 && !deadRef.current) {
				const reflected = Math.max(1, Math.floor(stats.thorns));
				// Live ref, not top-of-tick snapshot — a player swing earlier
				// in this tick may have already updated currentHp, and writing
				// the stale snapshot back would silently erase that damage.
				const enemyAtNow = enemyRef.current ?? currentEnemy;
				const { updated, hpDamage } = applyDamageToEnemy(
					reflected,
					enemyAtNow,
				);
				pushEvent({
					amount: hpDamage,
					target: "enemy",
					isThorns: true,
				});
				if (updated.currentHp <= 0) {
					resolveKill(updated);
				}
			}
		}
	});

	// Periodic HP + barrier sync — skips when neither has changed.
	useTicker(active, HP_SYNC_INTERVAL_MS, () => {
		if (deadRef.current) return;
		const hp = playerHpRef.current;
		const br = barrierRef.current.current;
		const hpChanged = hp !== lastSyncedHpRef.current;
		const brChanged = br !== lastSyncedBarrierRef.current;
		if (!hpChanged && !brChanged) return;
		lastSyncedHpRef.current = hp;
		lastSyncedBarrierRef.current = br;
		syncHp(withSession({ characterId, hpCurrent: hp, barrierCurrent: br })).catch(() => {
			lastSyncedHpRef.current = -1;
			lastSyncedBarrierRef.current = -1;
		});
	});

	// Guards read the ref so the callback identity is stable across combat
	// ticks (playerHp state changes every damage frame; including it in deps
	// would recreate the callback at 50ms cadence and invalidate any
	// downstream memoization).
	const usePotion = useCallback(async () => {
		if (potions <= 0 || playerHpRef.current >= maxHp) return;
		const prevHp = playerHpRef.current;
		const heal = Math.floor(maxHp * POTION_HEAL_FRACTION);
		const optimisticHp = Math.min(maxHp, prevHp + heal);
		const appliedHeal = optimisticHp - prevHp;
		playerHpRef.current = optimisticHp;
		setPlayerHp(optimisticHp);
		lastSyncedHpRef.current = optimisticHp;
		// HP is local-only (hook state). Potion count comes from the Convex
		// character query; `consumePotion` wraps the localStore decrement so
		// no race against concurrent `recordKill` drops.
		try {
			await consumePotion(withSession({ characterId, clientHp: prevHp }));
		} catch {
			const reverted = Math.max(0, playerHpRef.current - appliedHeal);
			playerHpRef.current = reverted;
			setPlayerHp(reverted);
			lastSyncedHpRef.current = -1;
		}
	}, [potions, maxHp, characterId, consumePotion, withSession]);

	const restoreToFull = useCallback(() => {
		playerHpRef.current = maxHp;
		setPlayerHp(maxHp);
		lastSyncedHpRef.current = maxHp;
		const full = makeBarrierState(stats.maxBarrier);
		barrierRef.current = full;
		setBarrier(full);
		lastSyncedBarrierRef.current = stats.maxBarrier;
	}, [maxHp, stats.maxBarrier]);

	return {
		playerHp,
		barrier,
		usePotion,
		restoreToFull,
	};
}

export type { BarrierState };
