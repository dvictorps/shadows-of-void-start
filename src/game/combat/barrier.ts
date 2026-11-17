import { BARRIER_REFILL_DELAY_SECONDS } from "./constants";

export interface BarrierState {
	current: number;
	max: number;
	refillRemaining: number;
}

export function makeBarrierState(max: number): BarrierState {
	return {
		current: max,
		max,
		refillRemaining: 0,
	};
}

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

export interface BarrierDamageResult {
	state: BarrierState;
	lifeOverflow: number;
}

export function damageBarrier(
	state: BarrierState,
	rawDamage: number,
): BarrierDamageResult {
	if (rawDamage <= 0) return { state, lifeOverflow: 0 };
	if (state.current <= 0) return { state, lifeOverflow: rawDamage };
	const absorbed = Math.min(state.current, rawDamage);
	const newCurrent = state.current - absorbed;
	const justEmptied = newCurrent === 0;
	const lifeOverflow = rawDamage - absorbed;
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

export function tickBarrier(state: BarrierState, dt: number): BarrierState {
	if (state.refillRemaining <= 0) return state;
	const nextRemaining = Math.max(0, state.refillRemaining - dt);
	if (nextRemaining === state.refillRemaining) return state;
	if (nextRemaining === 0) {
		return { ...state, refillRemaining: 0, current: state.max };
	}
	return { ...state, refillRemaining: nextRemaining };
}
