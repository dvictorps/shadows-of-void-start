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
const HP_SYNC_INTERVAL_MS = 10000;
const HP_SYNC_CHECK_MS = 1000;

export interface Vitals {
	hpCurrent: number;
	barrierCurrent: number;
}

type Params = {
	active: boolean;
	isEngaged: boolean;
	enemy: Enemy | null;
	stats: ComputedCharacterStats;
	initialHp: number;
	potions: number;
	barrierApi: BarrierApi;
	onPlayerDeath: () => void;
	resolveKill: (killed: Enemy) => void;
	pushEvent: (event: Omit<DamageEvent, "id">) => void;
	updateEnemy: (next: Enemy) => void;
	syncVitals: (vitals: Vitals) => Promise<void>;
	consumePotion: (clientHp: number) => Promise<void>;
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
	const lastSyncAtRef = useRef(0);
	const { barrierRef } = barrierApi;
	const enemyBarrierRef = useRef<BarrierState>(makeBarrierState(0));
	const leechRef = useRef<LeechInstance[]>([]);
	const leechHealAccRef = useRef(0);
	const lastLeechEventRef = useRef(0);
	const deadRef = useRef(false);
	const regenAccRef = useRef(0);

	const enemyRef = useRef<Enemy | null>(enemy);

	useLayoutEffect(() => {
		playerHpRef.current = playerHp;
		initialHpRef.current = initialHp;
		enemyRef.current = enemy;
	});

	const playerProgressRef = useRef(0);
	const enemyProgressRef = useRef(0);
	const nextSwingIndexRef = useRef(0);

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

	const activeRef = useRef(active);
	useEffect(() => {
		const wasActive = activeRef.current;
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

	const healPlayer = (amount: number) => {
		if (amount <= 0 || deadRef.current) return 0;
		const next = Math.min(maxHp, playerHpRef.current + amount);
		const healed = next - playerHpRef.current;
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

	const killIfDead = (updated: Enemy) => {
		if (updated.currentHp > 0) return false;
		applyHeal(stats.lifeOnKill);
		resolveKill(updated);
		return true;
	};

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

		const { updated } = applyDamageToEnemy(result.amount, currentEnemy);
		pushEvent({
			amount: result.amount,
			target: "enemy",
			isCrit: result.isCrit,
			weaponType: swing.weaponType,
		});
		deps.playPlayerSwingSfx(swing.weaponType);

		const leechSrc = result.breakdown.physical;
		if (stats.lifeLeechPercent > 0 && leechSrc > 0) {
			const inst = createLeechInstance(leechSrc, stats.lifeLeechPercent);
			if (inst) leechRef.current.push(inst);
		}

		applyHeal(stats.lifeGainOnHit);
		return killIfDead(updated);
	};

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

	const forgetSyncedVitals = useCallback(() => {
		lastSyncedHpRef.current = -1;
		lastSyncedBarrierRef.current = -1;
	}, []);

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

	useTicker(active, HP_SYNC_CHECK_MS, () => {
		if (deadRef.current) return;
		if (Date.now() - lastSyncAtRef.current < HP_SYNC_INTERVAL_MS) return;
		const hpChanged = playerHpRef.current !== lastSyncedHpRef.current;
		const brChanged =
			barrierRef.current.current !== lastSyncedBarrierRef.current;
		if (!hpChanged && !brChanged) return;
		syncVitals(vitalsForKill()).catch(forgetSyncedVitals);
	});

	const drinkPotion = useCallback(async () => {
		if (potions <= 0 || playerHpRef.current >= maxHp) return;
		const prevHp = playerHpRef.current;
		const heal = Math.floor(maxHp * POTION_HEAL_FRACTION);
		const optimisticHp = Math.min(maxHp, prevHp + heal);
		const appliedHeal = optimisticHp - prevHp;
		playerHpRef.current = optimisticHp;
		setPlayerHp(optimisticHp);
		lastSyncedHpRef.current = optimisticHp;
		try {
			await consumePotion(prevHp);
		} catch {
			const reverted = Math.max(0, playerHpRef.current - appliedHeal);
			playerHpRef.current = reverted;
			setPlayerHp(reverted);
			lastSyncedHpRef.current = -1;
		}
	}, [potions, maxHp, consumePotion]);

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
