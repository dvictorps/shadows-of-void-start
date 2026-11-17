import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Sparkles } from "lucide-react";

import { Button } from "#/components/ui/button";
import { m } from "#/paraglide/messages";

export default function CombatTopHud({
	zoneName,
	zoneLevel,
	ambushActive,
	bagCount,
	onOpenBag,
	onRetreat,
}: {
	zoneName: string;
	zoneLevel: number;
	ambushActive: boolean;
	bagCount: number;
	onOpenBag: () => void;
	onRetreat: () => void;
}) {
	return (
		<>
			<AnimatePresence>
				{ambushActive && (
					<motion.div
						key="ambush-banner"
						initial={{ opacity: 0, y: -8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
						transition={{ duration: 0.4 }}
						className="-translate-x-1/2 pointer-events-none absolute top-5 left-1/2 z-20 select-none"
						aria-live="polite"
					>
						<span
							className="display-title text-2xl uppercase tracking-[0.3em] text-red-400"
							style={{
								textShadow:
									"0 0 18px rgba(248, 113, 113, 0.7), 0 2px 6px rgba(0, 0, 0, 0.9)",
							}}
						>
							{m.ambush_banner()}
						</span>
					</motion.div>
				)}
			</AnimatePresence>
			<div className="absolute left-3 top-3 flex flex-col gap-0.5 text-xl uppercase tracking-[0.2em] text-white/60">
				<span>{zoneName}</span>
				<span className="text-base text-white/40">LV {zoneLevel}</span>
			</div>

			<div className="absolute top-3 right-3 z-10 flex items-center gap-2">
				<Button
					variant="hud"
					size="hud-icon"
					onClick={onOpenBag}
					disabled={bagCount === 0}
					aria-label={`Loot bag (${bagCount} items)`}
					className="relative"
				>
					<Sparkles strokeWidth={2} />
					{bagCount > 0 && (
						<span className="absolute -top-1.5 -right-1.5 min-w-[1.25rem] border border-white bg-black px-1 text-center font-bold text-xs text-white leading-tight">
							{bagCount}
						</span>
					)}
				</Button>
				<Button
					variant="hud"
					size="hud-lg"
					caps
					onClick={onRetreat}
					aria-label={m.retreat_to_map()}
				>
					<ArrowLeft strokeWidth={2} />
					{m.retreat()}
				</Button>
			</div>
		</>
	);
}
