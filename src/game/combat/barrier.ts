import {
	BARRIER_COOLDOWN_SECONDS,
	BARRIER_REGEN_FRACTION_PER_SECOND,
} from "./constants";

export interface BarrierState {
	current: number;
	max: number;
	/**
	 * Seconds remaining until regen resumes after a barrier break. 0 means
	 * regen is active (the normal state); positive means regen is paused and
	 * incoming damage bleeds straight to life. See ADR 0005.
	 */
	cooldownRemaining: number;
}

export function makeBarrierState(max: number): BarrierState {
	return {
		current: max,
		max,
		cooldownRemaining: 0,
	};
}

/**
 * Reconcile the barrier state with a possibly-changed max (e.g. after a gear
 * swap). Current is clamped to the new max; cooldown is preserved. There is
 * no free refill — a gear swap that raises the ceiling does not refill the
 * pool. See ADR 0005.
 */
export function rescaleBarrier(
	state: BarrierState,
	newMax: number,
): BarrierState {
	if (newMax <= 0) {
		return { current: 0, max: 0, cooldownRemaining: 0 };
	}
	const current = Math.min(state.current, newMax);
	return { current, max: newMax, cooldownRemaining: state.cooldownRemaining };
}

/**
 * Subtracts incoming barrier-portion of damage. Returns new state plus the
 * amount that bled through to life. When the hit empties the barrier, the
 * cooldown starts. The cooldown does NOT reset on subsequent damage during
 * the window — damage just hits life directly.
 */
export function damageBarrier(
	state: BarrierState,
	damage: number,
): { state: BarrierState; lifeOverflow: number } {
	if (damage <= 0) return { state, lifeOverflow: 0 };
	if (state.current <= 0) return { state, lifeOverflow: damage };
	const absorbed = Math.min(state.current, damage);
	const newCurrent = state.current - absorbed;
	const justEmptied = newCurrent === 0 && state.current > 0;
	return {
		state: {
			current: newCurrent,
			max: state.max,
			cooldownRemaining: justEmptied
				? BARRIER_COOLDOWN_SECONDS
				: state.cooldownRemaining,
		},
		lifeOverflow: damage - absorbed,
	};
}

/**
 * Advances the barrier state by `dt` seconds.
 *
 * - During cooldown (`cooldownRemaining > 0`): decrement the cooldown; regen
 *   is paused.
 * - Otherwise: regen `max × BARRIER_REGEN_FRACTION_PER_SECOND × dt` into
 *   `current`, clamped to `max`.
 *
 * Safe to call every frame regardless of barrier state — returns the same
 * reference when no change is needed. See ADR 0005.
 */
export function tickBarrier(state: BarrierState, dt: number): BarrierState {
	if (state.max <= 0) return state;
	if (state.cooldownRemaining > 0) {
		const nextCd = Math.max(0, state.cooldownRemaining - dt);
		if (nextCd === state.cooldownRemaining) return state;
		return { ...state, cooldownRemaining: nextCd };
	}
	if (state.current >= state.max) return state;
	const regen = state.max * BARRIER_REGEN_FRACTION_PER_SECOND * dt;
	const nextCurrent = Math.min(state.max, state.current + regen);
	if (nextCurrent === state.current) return state;
	return { ...state, current: nextCurrent };
}
