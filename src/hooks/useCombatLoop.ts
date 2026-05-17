import { useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { rollEnemyDamage, rollPlayerDamage } from "#/game/combat/damage";
import type { GeneratedItem } from "#/game/items/types";
import {
	findMonster,
	type MonsterDefinition,
	type MonsterId,
} from "#/game/monsters";
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
};

export type { DamageEvent };

type Params = {
	characterId: Id<"characters">;
	maxHp: number;
	initialHp: number;
	initialPotions: number;
	weapon: GeneratedItem | null;
	monsterPool: readonly MonsterId[];
	active: boolean;
	onPlayerDeath: () => void;
};

const SEARCH_DELAY_MS = 1500;
const VICTORY_DELAY_MS = 800;
const TICK_INTERVAL_MS = 50;
const HP_SYNC_INTERVAL_MS = 2000;

export function useCombatLoop({
	characterId,
	maxHp,
	initialHp,
	initialPotions,
	weapon,
	monsterPool,
	active,
	onPlayerDeath,
}: Params) {
	const [state, setState] = useState<CombatState>("searching");
	const [enemy, setEnemy] = useState<Enemy | null>(null);
	const [playerHp, setPlayerHp] = useState(initialHp);
	const [potions, setPotions] = useState(initialPotions);
	const [lastXpGain, setLastXpGain] = useState<number | null>(null);
	const { events, push: pushEvent } = useDamageEvents();

	// Refs the interval callbacks read directly for mid-tick state visibility
	// (state changes inside a tick aren't visible via closure until next render).
	const stateRef = useRef(state);
	stateRef.current = state;
	const playerProgressRef = useRef(0);
	const enemyProgressRef = useRef(0);
	const deadRef = useRef(false);

	// Stable refs for the activation transition handler — these are read only
	// when active flips, not as effect dependencies (otherwise every Convex
	// push of a fresh character object would re-fire the effect needlessly).
	const initialHpRef = useRef(initialHp);
	initialHpRef.current = initialHp;
	const initialPotionsRef = useRef(initialPotions);
	initialPotionsRef.current = initialPotions;
	const playerHpRef = useRef(playerHp);
	playerHpRef.current = playerHp;
	const lastSyncedHpRef = useRef(initialHp);

	const syncHp = useMutation(api.characters.syncHp);
	const recordKill = useMutation(api.characters.recordKill);
	const consumePotion = useMutation(api.characters.usePotion);

	// ── Activation transitions: pull fresh server HP on entry, flush on exit.
	const activeRef = useRef(active);
	useEffect(() => {
		const wasActive = activeRef.current;
		if (active && !wasActive) {
			setPlayerHp(initialHpRef.current);
			setPotions(initialPotionsRef.current);
			lastSyncedHpRef.current = initialHpRef.current;
			deadRef.current = false;
		} else if (!active && wasActive) {
			syncHp({ characterId, hpCurrent: playerHpRef.current }).catch(() => {});
			lastSyncedHpRef.current = playerHpRef.current;
		}
		activeRef.current = active;
	}, [active, characterId, syncHp]);

	// ── Search delay → spawn enemy
	useDelay(active && state === "searching", SEARCH_DELAY_MS, () => {
		const pick = pickRandom(monsterPool);
		if (!pick) return;
		const def = findMonster(pick);
		if (!def) return;
		setEnemy({ def, currentHp: def.baseStats.hp });
		playerProgressRef.current = 0;
		enemyProgressRef.current = 0;
		setState("engaged");
	});

	// ── Victory pause → back to searching
	useDelay(active && state === "victory", VICTORY_DELAY_MS, () => {
		setEnemy(null);
		setLastXpGain(null);
		setState("searching");
	});

	// ── Engaged tick: player + enemy attack progress
	const enemyDef = enemy?.def ?? null;
	const playerAttackSpeed = weapon?.computedStats?.attackSpeed ?? 1;
	const enemyAttackSpeed = enemyDef?.baseStats.attackSpeed ?? 1;

	useTicker(
		active && state === "engaged" && enemyDef !== null,
		TICK_INTERVAL_MS,
		() => {
			if (stateRef.current !== "engaged" || deadRef.current || !enemyDef)
				return;

			const dt = TICK_INTERVAL_MS / 1000;
			playerProgressRef.current += dt * playerAttackSpeed;
			enemyProgressRef.current += dt * enemyAttackSpeed;

			const playerSwing = playerProgressRef.current >= 1;
			if (playerSwing) playerProgressRef.current -= 1;
			const enemySwing = enemyProgressRef.current >= 1;
			if (enemySwing) enemyProgressRef.current -= 1;

			// Player acts first. Detect kill via flag set in updater, fire side
			// effects (XP, state transition, server record) afterwards so StrictMode
			// double-invocation of the updater doesn't double-trigger them.
			if (playerSwing) {
				const dmg = rollPlayerDamage(weapon);
				let killed = false;
				setEnemy((prev) => {
					if (!prev) return prev;
					if (prev.currentHp <= 0) return prev; // already dead, ignore extra swings
					const newHp = Math.max(0, prev.currentHp - dmg.amount);
					if (newHp <= 0) killed = true;
					return { ...prev, currentHp: newHp };
				});
				pushEvent({ amount: dmg.amount, target: "enemy", isCrit: dmg.isCrit });

				if (killed && enemyDef && stateRef.current === "engaged") {
					stateRef.current = "victory";
					setLastXpGain(enemyDef.xpReward);
					setState("victory");
					recordKill({
						characterId,
						monsterId: enemyDef.id,
					}).catch(() => {});
					return;
				}
			}

			// Enemy only swings if still engaged after player's hit.
			if (enemySwing && stateRef.current === "engaged") {
				const dmg = rollEnemyDamage(enemyDef);
				setPlayerHp((prev) => {
					const newHp = Math.max(0, prev - dmg);
					if (newHp <= 0 && !deadRef.current) {
						deadRef.current = true;
						queueMicrotask(() => onPlayerDeath());
					}
					return newHp;
				});
				pushEvent({ amount: dmg, target: "player" });
			}
		},
	);

	// ── Periodic HP sync. Skip the round-trip when the value hasn't changed
	// since the last successful sync — saves ~30 no-op mutations/min.
	useTicker(active, HP_SYNC_INTERVAL_MS, () => {
		const hp = playerHpRef.current;
		if (hp === lastSyncedHpRef.current) return;
		lastSyncedHpRef.current = hp;
		syncHp({ characterId, hpCurrent: hp }).catch(() => {
			// Roll back the watermark so the next tick retries.
			lastSyncedHpRef.current = -1;
		});
	});

	const usePotion = useCallback(async () => {
		if (potions <= 0 || playerHp >= maxHp) return;
		try {
			const result = await consumePotion({ characterId });
			setPlayerHp(result.hpCurrent);
			setPotions(result.potions);
			lastSyncedHpRef.current = result.hpCurrent;
		} catch {
			// ignore — surfaced via sync on next event
		}
	}, [potions, playerHp, maxHp, characterId, consumePotion]);

	return {
		state,
		enemy,
		playerHp,
		potions,
		events,
		lastXpGain,
		usePotion,
	};
}
