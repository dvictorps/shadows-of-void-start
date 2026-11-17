import { useAnimationControls } from "framer-motion";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";

import type { DamageEvent, Enemy } from "#/hooks/useCombatLoop";

import { type CombatSceneState, isStagedEnemy } from "./reveal";

export function useEnemySpriteMotion({
	enemy,
	state,
	enemyEvents,
}: {
	enemy: Enemy | null;
	state: CombatSceneState;
	enemyEvents: DamageEvent[];
}) {
	const isStaged = isStagedEnemy(enemy);
	const lastDamagingHit = useMemo(
		() => enemyEvents.findLast((e) => !e.isMiss && !e.isBlocked) ?? null,
		[enemyEvents],
	);
	const enemyControls = useAnimationControls();
	const redFlashControls = useAnimationControls();
	const prevEnemyRef = useRef<Enemy | null>(null);

	useLayoutEffect(() => {
		const wasNull = prevEnemyRef.current === null;
		prevEnemyRef.current = enemy;
		if (!enemy) return;
		if (!wasNull) return;
		enemyControls.set({
			opacity: 0,
			scale: isStaged ? 1.2 : 1,
			x: 0,
			y: isStaged ? 0 : 8,
			filter: isStaged
				? "brightness(1) saturate(1) hue-rotate(0deg)"
				: "brightness(1) saturate(1) blur(4px)",
		});
		void enemyControls.start({
			opacity: 1,
			scale: 1,
			y: 0,
			filter: "brightness(1) saturate(1) hue-rotate(0deg)",
			transition: { duration: isStaged ? 0.7 : 0.4, ease: "easeOut" },
		});
	}, [enemy, enemyControls, isStaged]);

	useEffect(() => {
		if (!lastDamagingHit) return;
		const amp = lastDamagingHit.isCrit ? 6 : 4;
		void enemyControls.start({
			x: [0, -amp, amp, -Math.round(amp * 0.7), Math.round(amp * 0.5), 0],
			transition: { duration: 0.2, times: [0, 0.2, 0.4, 0.6, 0.8, 1] },
		});
		void redFlashControls.start({
			opacity: [0, 1, 0],
			transition: { duration: 0.22, times: [0, 0.18, 1], ease: "easeOut" },
		});
	}, [lastDamagingHit, enemyControls, redFlashControls]);

	useEffect(() => {
		// oxlint-disable-next-line you-might-not-need-an-effect/no-event-handler -- the sprite's `animate` is bound to `enemyControls`, which the entrance (set+start on null→enemy) and hit shake also drive imperatively; framer-motion can't mix a controls object with a declarative target on one element, and the victory transition happens in useCombatLoop's tick, not a UI event here
		if (state !== "victory" || !enemy) return;
		void enemyControls.start({
			opacity: 0,
			y: isStaged ? 0 : 8,
			filter: isStaged
				? "brightness(1) saturate(1) hue-rotate(0deg)"
				: "brightness(1) saturate(1) blur(4px)",
			transition: { duration: 0.5, ease: "easeIn" },
		});
	}, [state, enemy, enemyControls, isStaged]);

	return { enemyControls, redFlashControls };
}
