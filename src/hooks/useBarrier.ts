// ─────────────────────────────────────────────────────────────────────────────
//  Owns the player's BarrierState as a single source of truth across all
//  views (map / combat / city / travel). Replaces the dual-ref pattern where
//  useCombatTick carried `barrierRef` and world.tsx carried
//  `outOfCombatBarrierRef`, synced via a view-change useEffect and a manual
//  syncHp mutation on combat entry.
//
//  The refill cycle (10s post-break, instant snap to max — ADR 0005) advances
//  via the internal 100ms ticker continuously while `active`. The ticker is a
//  no-op when refillRemaining === 0, so an idle full-barrier player costs
//  nothing per tick. Damage applies via `applyDamage` (wraps damageBarrier);
//  city entry / level-up call `restoreToFull` to snap back to max.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import {
	type BarrierState,
	damageBarrier,
	makeBarrierState,
	rescaleBarrier,
	tickBarrier,
} from "#/game/combat/barrier";
import { useTicker } from "./useTicker";

export type BarrierApi = {
	barrier: BarrierState;
	barrierRef: React.MutableRefObject<BarrierState>;
	/**
	 * Apply incoming damage to the barrier pool (with the +50% absorption
	 * multiplier from damageBarrier). Returns the un-absorbed remainder that
	 * the caller should route to life.
	 */
	applyDamage: (rawDamage: number) => { lifeOverflow: number };
	/**
	 * Reset to a full pool with no active refill cycle. Used by city entry
	 * and by the level-up branch (which can pass `overrideMax` when the live
	 * stats prop hasn't yet rendered into this hook's closure).
	 */
	restoreToFull: (overrideMax?: number) => void;
};

type Params = {
	maxBarrier: number;
	/** Server-persisted cold-start value. When unset, seeds at maxBarrier. */
	initialBarrier?: number;
	/** Gates the ticker. Pass true while the character is in /world. */
	active: boolean;
};

export function useBarrier({
	maxBarrier,
	initialBarrier,
	active,
}: Params): BarrierApi {
	const [barrier, setBarrier] = useState<BarrierState>(() => {
		if (initialBarrier !== undefined && initialBarrier < maxBarrier) {
			const s = makeBarrierState(maxBarrier);
			s.current = initialBarrier;
			return s;
		}
		return makeBarrierState(maxBarrier);
	});
	const barrierRef = useRef(barrier);
	barrierRef.current = barrier;

	// Rescale on max-barrier change (gear swap). Preserves current + refill
	// timer; the `seedAtFull` branch in rescaleBarrier covers the edge case
	// where the player unequipped silk mid-cooldown and re-equipped after
	// the timer expired (see ADR 0005).
	useEffect(() => {
		setBarrier((prev) => {
			const next = rescaleBarrier(prev, maxBarrier);
			if (next === prev) return prev;
			barrierRef.current = next;
			return next;
		});
	}, [maxBarrier]);

	// Single global ticker. Free when refillRemaining === 0 (tickBarrier
	// returns the same reference). Replaces the two prior tickers (engaged
	// 50ms inline + out-of-combat 500ms). 100ms granularity is invisible on
	// a 10s refill window.
	useTicker(active, 100, () => {
		const next = tickBarrier(barrierRef.current, 0.1);
		if (next !== barrierRef.current) {
			barrierRef.current = next;
			setBarrier(next);
		}
	});

	const applyDamage = useCallback((rawDamage: number) => {
		const { state, lifeOverflow } = damageBarrier(barrierRef.current, rawDamage);
		if (state !== barrierRef.current) {
			barrierRef.current = state;
			setBarrier(state);
		}
		return { lifeOverflow };
	}, []);

	const restoreToFull = useCallback(
		(overrideMax?: number) => {
			const max = overrideMax ?? maxBarrier;
			const full = makeBarrierState(max);
			barrierRef.current = full;
			setBarrier(full);
		},
		[maxBarrier],
	);

	return { barrier, barrierRef, applyDamage, restoreToFull };
}
