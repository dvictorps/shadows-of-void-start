import {
	AnimatePresence,
	motion,
	type useAnimationControls,
} from "framer-motion";
import { useState } from "react";
import { createPortal } from "react-dom";

import type { BossConfig } from "#/game/bosses";
import type { DamageEvent, Enemy } from "#/hooks/useCombatLoop";

import HitFx from "../HitFx";
import MonsterTooltip from "../MonsterTooltip";

type Controls = ReturnType<typeof useAnimationControls>;

export default function EnemySprite({
	enemy,
	displayName,
	bossConfig,
	enemyControls,
	redFlashControls,
	lastSwingHit,
}: {
	enemy: Enemy;
	displayName: string;
	bossConfig: BossConfig | null;
	enemyControls: Controls;
	redFlashControls: Controls;
	// Latest weapon hit that landed (block included): mounts the HitFx.
	lastSwingHit: DamageEvent | null;
}) {
	// Hovered sprite element, kept in state (not a ref) so the tooltip can
	// measure it on every render. The scene re-renders on each combat tick,
	// so the tooltip follows the boss-intro shake and sprite size changes.
	// Non-null doubles as the "hovering" flag.
	const [hoveredSprite, setHoveredSprite] = useState<HTMLDivElement | null>(
		null,
	);
	return (
		<div
			className="group relative"
			onMouseEnter={(e) => setHoveredSprite(e.currentTarget)}
			onMouseLeave={() => setHoveredSprite(null)}
		>
			<motion.div
				className={`relative h-64 w-64 ${enemy.rarity === "unique" ? "scale-150" : ""}`}
				animate={enemyControls}
			>
				<img
					src={enemy.def.sprite}
					alt={displayName}
					draggable={false}
					className="pointer-events-none h-full w-full select-none object-contain"
				/>
				{/* Solid-red hit-flash silhouette: the sprite acts as the
				 * mask so only the opaque pixels get repainted, and the
				 * underlying image stays put. */}
				<motion.div
					aria-hidden
					initial={{ opacity: 0 }}
					animate={redFlashControls}
					className="pointer-events-none absolute inset-0"
					style={{
						backgroundColor: "#ff2a2a",
						WebkitMaskImage: `url(${enemy.def.sprite})`,
						maskImage: `url(${enemy.def.sprite})`,
						WebkitMaskRepeat: "no-repeat",
						maskRepeat: "no-repeat",
						WebkitMaskPosition: "center",
						maskPosition: "center",
						WebkitMaskSize: "contain",
						maskSize: "contain",
					}}
				/>
			</motion.div>
			<AnimatePresence>
				{lastSwingHit && (
					<HitFx
						key={lastSwingHit.id}
						weaponType={lastSwingHit.weaponType ?? "sword"}
						isCrit={lastSwingHit.isCrit}
					/>
				)}
			</AnimatePresence>
			{enemy.rarity !== "normal" && hoveredSprite && (
				<SpriteTooltipPortal
					sprite={hoveredSprite}
					enemy={enemy}
					bossConfig={bossConfig}
				/>
			)}
		</div>
	);
}

function SpriteTooltipPortal({
	sprite,
	enemy,
	bossConfig,
}: {
	sprite: HTMLDivElement;
	enemy: Enemy;
	bossConfig: BossConfig | null;
}) {
	// A sprite that unmounted between fights never fires mouseleave; a
	// detached element measures as an empty box at the origin, so hide.
	if (!sprite.isConnected) return null;
	const rect = sprite.getBoundingClientRect();
	return createPortal(
		<div
			className="pointer-events-none fixed z-[9999]"
			style={{
				top: rect.bottom + 8,
				left: rect.left + rect.width / 2,
				transform: "translateX(-50%)",
			}}
		>
			<MonsterTooltip enemy={enemy} bossConfig={bossConfig} />
		</div>,
		document.body,
	);
}
