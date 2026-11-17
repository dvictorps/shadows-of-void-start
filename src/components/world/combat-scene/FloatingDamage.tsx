import { motion } from "framer-motion";

import type { DamageEvent } from "#/hooks/useCombatLoop";
import { hashStringToUnit } from "#/lib/rng";

export default function FloatingDamage({
	event,
	variant = "enemy",
}: {
	event: DamageEvent;
	variant?: "enemy" | "player";
}) {
	const seed = hashStringToUnit(event.id);
	const isCrit = event.isCrit && !event.isMiss;
	const isBlocked = event.isBlocked && !event.isMiss;
	const isThorns = event.isThorns;
	const isLabel = event.isMiss || isBlocked;

	const angle = -Math.PI / 2 + (seed - 0.5) * 1.8;
	const distance = 70;
	const endX = Math.cos(angle) * distance;
	const endY = Math.sin(angle) * distance;
	const startOffset = 24;
	const startX = Math.cos(angle) * startOffset;
	const startY = Math.sin(angle) * startOffset;

	const isHeal = event.isHealing;

	let color: string;
	let display: string;
	if (isHeal) {
		const rounded = Math.round(event.amount);
		if (rounded <= 0) return null;
		color = "text-green-400";
		display = `+${rounded}`;
	} else if (event.isMiss) {
		color = "text-white/60";
		display = "MISS";
	} else if (isBlocked) {
		color = "text-blue-300";
		display = "BLOCK";
	} else if (isThorns) {
		color = "text-purple-300";
		display = `${event.amount}`;
	} else if (isCrit) {
		color = "text-red-500";
		display = `${event.amount}!!!`;
	} else {
		color = variant === "player" ? "text-red-400" : "text-white";
		display = `${event.amount}`;
	}

	return (
		<motion.div
			className="pointer-events-none absolute select-none"
			style={{ textShadow: "0 2px 4px rgba(0,0,0,0.9)" }}
			initial={{ opacity: 1, x: startX, y: startY }}
			animate={{ opacity: 0, x: endX, y: endY }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.6, ease: "easeOut" }}
		>
			<span
				className={`block font-bold ${isLabel ? "text-xl uppercase tracking-wider" : "text-3xl"} ${color}`}
			>
				{display}
			</span>
		</motion.div>
	);
}
