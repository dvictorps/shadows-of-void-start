import { useEffect, useEffectEvent } from "react";

import { typedKeys } from "#/game/typed-object";

/**
 * Walks an intro cinematic through its stages while `active`: each stage
 * holds for its entry in `durations`, then moves to the next key (the table's
 * key order is the stage order). After the last stage it sets `null` and calls
 * `onDone`. Re-arms on every stage change, so two stages of equal length
 * still each get their own timer; cancelled when `active` drops or on unmount.
 * `durations` must be a stable reference (a module constant): a new object
 * each render re-arms the timer and stalls the cascade.
 */
export function useStageCascade<Stage extends string>(
	active: boolean,
	stage: Stage | null,
	durations: Readonly<Record<Stage, number>>,
	setStage: (next: Stage | null) => void,
	onDone: () => void,
): void {
	const advance = useEffectEvent((from: Stage) => {
		const order = typedKeys(durations);
		const next = order[order.findIndex((s) => s === from) + 1];
		if (next === undefined) {
			setStage(null);
			onDone();
			return;
		}
		setStage(next);
	});

	useEffect(() => {
		if (!active || stage === null) return;
		const id = window.setTimeout(() => advance(stage), durations[stage]);
		return () => window.clearTimeout(id);
	}, [active, stage, durations]);
}
