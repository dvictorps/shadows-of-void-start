import { useAnimationControls } from "framer-motion";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";

import type { DamageEvent, Enemy } from "#/hooks/useCombatLoop";

import { type CombatSceneState, isStagedEnemy } from "./reveal";

/**
 * The sprite's imperative animation controls. Called by the arena, which
 * stays mounted for the whole scene, so the null → enemy transition is seen
 * even while the sprite itself is unmounted (searching, camp).
 */
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
	// Latest event that actually damaged the enemy. Drives the shake + flash.
	const lastDamagingHit = useMemo(
		() => enemyEvents.findLast((e) => !e.isMiss && !e.isBlocked) ?? null,
		[enemyEvents],
	);
	// Sprite-level controls drive both the entrance animation and the in-combat
	// shake. Three effects mutate them, ordered by lifecycle: spawn entrance →
	// damage shake → victory fade. Mixing the entrance into framer-motion's
	// `initial` prop wouldn't survive same-monster respawns (key collision), so
	// the entrance is imperative: detect the null → non-null transition on
	// `enemy` and re-issue set+start every fresh spawn.
	const enemyControls = useAnimationControls();
	// Separate controls for the red hit-flash overlay (the sprite shape
	// repainted solid red via CSS mask). Filter-based recolors couldn't push
	// every pixel to pure red on dark/colorful sprites — masking does.
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
		// Fire-and-forget: `start` resolves when the animation ends; nothing waits on it.
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
		// Brief solid-red flash via the masked overlay. Opacity drives it so
		// the underlying sprite shows back through as the flash fades.
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
