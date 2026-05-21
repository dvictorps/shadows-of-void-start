import { useMutation } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	damageBarrier,
	makeBarrierState,
	rescaleBarrier,
	tickBarrierRecovery,
} from "#/game/combat/barrier";
import { POTION_HEAL_FRACTION } from "#/game/combat/constants";
import {
	applyDamageToBarrierThenLife,
	rollEnemyAttack,
	rollPlayerSwing,
} from "#/game/combat/damage";
import type { LeechInstance } from "#/game/combat/leech";
import { createLeechInstance, tickLeechInstances } from "#/game/combat/leech";
import { rollMonsterLevel } from "#/game/loot/drops";
import {
	findMonster,
	type MonsterDefinition,
	type MonsterId,
	type ScaledMonsterStats,
	scaleMonsterStats,
} from "#/game/monsters";
import type { ComputedCharacterStats } from "#/game/stats/types";
import { pickRandom } from "#/lib/rng";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { type DamageEvent, useDamageEvents } from "./useDamageEvents";
import { useDelay } from "./useDelay";
import { useTicker } from "./useTicker";

type CombatState = "searching" | "engaged" | "victory";

export type Enemy = {
	def: MonsterDefinition;
	currentHp: number;
	level: number;
	scaled: ScaledMonsterStats;
};

/**
 * Defender profile the damage engine expects when the player attacks. Normal
 * mobs have no defensive stats yet — minibosses with rolled modifiers (see
 * CONTEXT.md "Monster Modifier Pool") will surface armor / evasion /
 * resistances here once the modifier roller lands.
 */
function defenderFromEnemy(enemy: Enemy) {
	return {
		armor: 0,
		evasion: 0,
		accuracy: 0,
		level: enemy.level,
		resistances: { cold: 0, fire: 0, lightning: 0, void: 0 },
	};
}

export type { DamageEvent };

type Params = {
	characterId: Id<"characters">;
	stats: ComputedCharacterStats;
	initialHp: number;
	initialPotions: number;
	monsterPool: readonly MonsterId[];
	zoneLevel: number;
	active: boolean;
	onPlayerDeath: () => void;
};

const SEARCH_DELAY_MS = 1500;
const VICTORY_DELAY_MS = 800;
const TICK_INTERVAL_MS = 50;
// Periodic sync is insurance against a mid-combat refresh — the deactivation
// effect (retreat / view change) already flushes the latest HP synchronously
// on graceful exits. 10s of potential lost-on-refresh HP is the tradeoff for
// the call-volume reduction. Self-skips when HP hasn't changed since the
// last write, so idle players make zero calls regardless of this interval.
const HP_SYNC_INTERVAL_MS = 10000;

export function useCombatLoop({
	characterId,
	stats,
	initialHp,
	initialPotions,
	monsterPool,
	zoneLevel,
	active,
	onPlayerDeath,
}: Params) {
	const maxHp = stats.maxLife;
	const [state, setState] = useState<CombatState>("searching");
	const [enemy, setEnemy] = useState<Enemy | null>(null);
	const [playerHp, setPlayerHp] = useState(initialHp);
	const [barrier, setBarrier] = useState(() =>
		makeBarrierState(stats.maxBarrier),
	);
	const [potions, setPotions] = useState(initialPotions);
	const [lastKill, setLastKill] = useState<{
		xp: number;
		potion: boolean;
	} | null>(null);
	const { events, push: pushEvent } = useDamageEvents();

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
	const initialPotionsRef = useRef(initialPotions);
	initialPotionsRef.current = initialPotions;
	const playerHpRef = useRef(playerHp);
	playerHpRef.current = playerHp;
	const lastSyncedHpRef = useRef(initialHp);

	const syncHp = useMutation(api.combat.syncHp);
	const recordKill = useMutation(api.combat.recordKill);
	const consumePotion = useMutation(api.combat.usePotion);

	// Optimistic XP popup mounts immediately; potion drop is patched in once the
	// server replies. Shared between player-swing kills and thorns-reflect kills.
	const resolveKill = useCallback(
		(killed: Enemy) => {
			const xpGained = killed.scaled.xpReward;
			stateRef.current = "victory";
			setLastKill({ xp: xpGained, potion: false });
			setState("victory");
			recordKill({
				characterId,
				monsterId: killed.def.id,
				monsterLevel: killed.level,
			})
				.then((result) => {
					if (result.potionDropped) {
						setLastKill({ xp: xpGained, potion: true });
						setPotions((p) => p + 1);
					}
				})
				.catch(() => {});
		},
		[characterId, recordKill],
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
			setPotions(initialPotionsRef.current);
			lastSyncedHpRef.current = initialHpRef.current;
			deadRef.current = false;
			enemyRef.current = null;
			setEnemy(null);
			setLastKill(null);
			leechRef.current = [];
			nextSwingIndexRef.current = 0;
			stateRef.current = "searching";
			setState("searching");
		} else if (!active && wasActive && !deadRef.current) {
			syncHp({ characterId, hpCurrent: playerHpRef.current }).catch(() => {});
			lastSyncedHpRef.current = playerHpRef.current;
		}
		activeRef.current = active;
	}, [active, characterId, syncHp]);

	// ── Search delay → spawn enemy ──
	useDelay(active && state === "searching", SEARCH_DELAY_MS, () => {
		const pick = pickRandom(monsterPool);
		if (!pick) return;
		const def = findMonster(pick);
		if (!def) return;
		const level = rollMonsterLevel(zoneLevel);
		const scaled = scaleMonsterStats(def, level);
		const newEnemy: Enemy = {
			def,
			currentHp: scaled.hp,
			level,
			scaled,
		};
		enemyRef.current = newEnemy;
		setEnemy(newEnemy);
		playerProgressRef.current = 0;
		enemyProgressRef.current = 0;
		nextSwingIndexRef.current = 0;
		setState("engaged");
	});

	// ── Victory pause → back to searching ──
	useDelay(active && state === "victory", VICTORY_DELAY_MS, () => {
		enemyRef.current = null;
		setEnemy(null);
		setLastKill(null);
		setState("searching");
	});

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
				}
			}

			if (enemySwing) {
				const attack = rollEnemyAttack({
					enemyLevel: currentEnemy.level,
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
				} else if (attack.isBlocked) {
					// Block → no damage to barrier/life, but the hit still "lands" for
					// thorns purposes (handled below).
					pushEvent({ amount: 0, target: "player", isBlocked: true });
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

					if (result.newLife <= 0 && !deadRef.current) {
						deadRef.current = true;
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
		const prevPotions = potions;
		const heal = Math.floor(maxHp * POTION_HEAL_FRACTION);
		const optimisticHp = Math.min(maxHp, prevHp + heal);
		playerHpRef.current = optimisticHp;
		setPlayerHp(optimisticHp);
		setPotions(prevPotions - 1);
		lastSyncedHpRef.current = optimisticHp;
		try {
			const result = await consumePotion({ characterId });
			playerHpRef.current = result.hpCurrent;
			setPlayerHp(result.hpCurrent);
			setPotions(result.potions);
			lastSyncedHpRef.current = result.hpCurrent;
		} catch {
			playerHpRef.current = prevHp;
			setPlayerHp(prevHp);
			setPotions(prevPotions);
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
		enemy,
		playerHp,
		barrier: barrierSnapshot,
		potions,
		events,
		lastKill,
		usePotion,
	};
}
