// Player BarrierState owner across map / combat / city / travel. See ADR 0005.

import { useCallback, useRef, useState } from "react";

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
	barrierRef: React.RefObject<BarrierState>;
	applyDamage: (rawDamage: number) => { lifeOverflow: number };
	/** Snap to full. `overrideMax` wins the level-up reactive-query race. */
	restoreToFull: (overrideMax?: number) => void;
};

type Params = {
	maxBarrier: number;
	initialBarrier?: number;
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
	// Every writer below (the ticker, applyDamage, restoreToFull and the two
	// prop-sync updaters) sets the ref alongside the state, so the ref never
	// needs a render-time resync.
	const barrierRef = useRef(barrier);

	// Both prop syncs below use React's "adjust state while rendering" pattern:
	// keep the previous input in state and queue the update during render
	// when it changes. The functional updaters chain in declaration order (cap
	// rescale first, then the server value clamped to the new cap) and keep
	// the ref in step for the ticker.
	//
	// Rescale the existing pool when the cap changes. `barrier` is also mutated
	// by the regen ticker and by damage, so it can't be derived from the cap.
	const [prevMaxBarrier, setPrevMaxBarrier] = useState(maxBarrier);
	if (maxBarrier !== prevMaxBarrier) {
		setPrevMaxBarrier(maxBarrier);
		setBarrier((prev) => {
			const next = rescaleBarrier(prev, maxBarrier);
			if (next === prev) return prev;
			barrierRef.current = next;
			return next;
		});
	}

	// Cold-start race: useState runs once at mount. When combatState arrives
	// from the character query after that (initialBarrier transitions from undefined to a
	// real value), `useState` would silently drop it and the periodic syncHp
	// would then overwrite the server with the local default. Pull the new
	// value in on prop change, clamped to current max. The mount value is
	// already applied by the lazy initializer above.
	const [prevInitialBarrier, setPrevInitialBarrier] = useState(initialBarrier);
	if (initialBarrier !== prevInitialBarrier) {
		setPrevInitialBarrier(initialBarrier);
		if (initialBarrier !== undefined) {
			setBarrier((prev) => {
				const clamped = Math.min(initialBarrier, prev.max);
				if (prev.current === clamped) return prev;
				const next = { ...prev, current: clamped };
				barrierRef.current = next;
				return next;
			});
		}
	}

	useTicker(active, 100, () => {
		const next = tickBarrier(barrierRef.current, 0.1);
		if (next !== barrierRef.current) {
			barrierRef.current = next;
			setBarrier(next);
		}
	});

	const applyDamage = useCallback((rawDamage: number) => {
		const { state, lifeOverflow } = damageBarrier(
			barrierRef.current,
			rawDamage,
		);
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
