import {
	BARRIER_DAMAGE_MULTIPLIER,
	BARRIER_REFILL_DELAY_SECONDS,
} from "./constants";

export interface BarrierState {
	current: number;
	max: number;
	/**
	 * Seconds remaining until the pool refills instantly to `max`. 0 means
	 * the barrier is in its steady-state (either full, partially damaged, or
	 * empty post-cooldown awaiting the next refill cycle). The cycle is
	 * driven exclusively by `damageBarrier` (sets the timer on break) and
	 * `tickBarrier` (decrements + does the instant refill at 0). No passive
	 * regen between hits. See ADR 0005 → 2026-05-28 update.
	 */
	refillRemaining: number;
}

export function makeBarrierState(max: number): BarrierState {
	return {
		current: max,
		max,
		refillRemaining: 0,
	};
}

/**
 * Reconcile the barrier state with a possibly-changed max (e.g. after a gear
 * swap). Current is clamped to the new max; refill timer is preserved.
 * A gear swap that raises the ceiling does not refill the pool — UNLESS the
 * state represents "nothing to preserve" (current 0 + no active refill cycle),
 * in which case the new pool seeds at full. Without that branch, breaking
 * barrier → unequipping silk past the 10s expiry → re-equipping would leave
 * the player stuck at 0 forever (the snap fired at max=0 during the unequip
 * window). See ADR 0005.
 */
export function rescaleBarrier(
	state: BarrierState,
	newMax: number,
): BarrierState {
	if (newMax <= 0) {
		if (state.current === 0 && state.max === 0) return state;
		return { current: 0, max: 0, refillRemaining: state.refillRemaining };
	}
	const seedAtFull = state.current === 0 && state.refillRemaining === 0;
	const current = seedAtFull ? newMax : Math.min(state.current, newMax);
	if (current === state.current && newMax === state.max) return state;
	return { current, max: newMax, refillRemaining: state.refillRemaining };
}

/**
 * Apply incoming damage to the barrier pool with the +50% multiplier:
 * every 1 raw damage drains 1.5 barrier. When the pool empties, the refill
 * timer starts; subsequent hits during the timer bypass barrier entirely
 * (current === 0 → all damage carries to life). See ADR 0005.
 */
export function damageBarrier(
	state: BarrierState,
	rawDamage: number,
): { state: BarrierState; lifeOverflow: number } {
	if (rawDamage <= 0) return { state, lifeOverflow: 0 };
	if (state.current <= 0) return { state, lifeOverflow: rawDamage };
	const effective = rawDamage * BARRIER_DAMAGE_MULTIPLIER;
	const absorbed = Math.min(state.current, effective);
	const newCurrent = state.current - absorbed;
	const justEmptied = newCurrent === 0;
	// lifeOverflow = the raw-damage equivalent of the un-absorbed portion.
	// `absorbed/effective` is the fraction of raw damage the barrier ate.
	const lifeOverflow = rawDamage * (1 - absorbed / effective);
	return {
		state: {
			current: newCurrent,
			max: state.max,
			refillRemaining: justEmptied
				? BARRIER_REFILL_DELAY_SECONDS
				: state.refillRemaining,
		},
		lifeOverflow,
	};
}

/**
 * Advances the barrier state by `dt` seconds.
 *
 * - If `refillRemaining > 0`: decrement; on reaching 0, snap `current` back
 *   to `max` (instant refill).
 * - Otherwise: NO-OP. No passive regen between hits — the barrier sits at
 *   its current value indefinitely until the next damage event or refill.
 *
 * Safe to call every frame regardless of barrier state — returns the same
 * reference when nothing changed.
 */
export function tickBarrier(state: BarrierState, dt: number): BarrierState {
	if (state.refillRemaining <= 0) return state;
	const nextRemaining = Math.max(0, state.refillRemaining - dt);
	if (nextRemaining === state.refillRemaining) return state;
	if (nextRemaining === 0) {
		return { ...state, refillRemaining: 0, current: state.max };
	}
	return { ...state, refillRemaining: nextRemaining };
}
