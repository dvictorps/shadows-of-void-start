import { BARRIER_RECOVERY_SECONDS } from "./constants";

export interface BarrierState {
	current: number;
	max: number;
	/** Seconds remaining until barrier refills to max. Null while barrier > 0. */
	recoveryRemaining: number | null;
}

export function makeBarrierState(max: number): BarrierState {
	return {
		current: max,
		max,
		recoveryRemaining: max > 0 ? null : 0,
	};
}

/**
 * Reconcile the barrier state with a possibly-changed max (e.g. after a gear
 * swap). Current is clamped to the new max; if the previous state was
 * recovering, the timer is preserved unless the max dropped to zero.
 */
export function rescaleBarrier(
	state: BarrierState,
	newMax: number,
): BarrierState {
	if (newMax <= 0) {
		return { current: 0, max: 0, recoveryRemaining: null };
	}
	const current = Math.min(state.current, newMax);
	return { current, max: newMax, recoveryRemaining: state.recoveryRemaining };
}

/**
 * Subtracts incoming barrier-portion of damage. Returns new state plus the
 * amount that bled through to life. If barrier just hit zero, kicks off the
 * recovery timer. The timer does NOT reset on subsequent damage.
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
			recoveryRemaining: justEmptied
				? BARRIER_RECOVERY_SECONDS
				: state.recoveryRemaining,
		},
		lifeOverflow: damage - absorbed,
	};
}

/**
 * Advances the recovery timer. When it elapses, barrier refills to max in one
 * step. Caller passes deltaSeconds elapsed since the last tick.
 */
export function tickBarrierRecovery(
	state: BarrierState,
	dt: number,
): BarrierState {
	if (state.recoveryRemaining === null) return state;
	if (state.max <= 0) return state;
	const next = state.recoveryRemaining - dt;
	if (next <= 0) {
		return { current: state.max, max: state.max, recoveryRemaining: null };
	}
	return { ...state, recoveryRemaining: next };
}
