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
	const barrierRef = useRef(barrier);

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
