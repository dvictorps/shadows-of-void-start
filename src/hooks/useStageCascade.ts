import { useEffect, useEffectEvent } from "react";

import { typedKeys } from "#/game/typed-object";

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
