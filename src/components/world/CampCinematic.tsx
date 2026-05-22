// Camp cinematic — renders inline in the central enemy area (same slot as
// ZoneCompletePanel) so the HUD around can fade out and back in cleanly.
// See CONTEXT.md → Acampamento.

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { translateCampLines } from "#/game/world/i18n";
import { m } from "#/paraglide/messages";

type Stage = 0 | 1 | 2 | "panel";

// Long holds on each ambient line — the moment is supposed to feel earned,
// not skipped through. 3 stages × ~3s ≈ ~9s before the decision panel
// appears. The text fade is also slow to match.
const STAGE_HOLD_MS = 3000;

const NEXT_STAGE: Record<Exclude<Stage, "panel">, Stage> = {
	0: 1,
	1: 2,
	2: "panel",
};

type Props = {
	zoneId: string;
	onReturn: () => void;
	onContinue: () => void;
};

export default function CampCinematic({
	zoneId,
	onReturn,
	onContinue,
}: Props) {
	const [stage, setStage] = useState<Stage>(0);
	const lines = translateCampLines(zoneId);

	useEffect(() => {
		if (stage === "panel") return;
		const id = window.setTimeout(
			() => setStage((prev) => (prev === "panel" ? prev : NEXT_STAGE[prev])),
			STAGE_HOLD_MS,
		);
		return () => window.clearTimeout(id);
	}, [stage]);

	return (
		<div className="flex flex-col items-center gap-6 px-6 text-center">
			<div className="flex h-16 items-center justify-center">
				<AnimatePresence mode="wait">
					{stage !== "panel" && (
						<motion.p
							key={stage}
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -6 }}
							transition={{ duration: 1.2, ease: "easeOut" }}
							className="display-title text-xl tracking-wide text-white/80"
						>
							{lines[stage]}
						</motion.p>
					)}
				</AnimatePresence>
			</div>

			<AnimatePresence>
				{stage === "panel" && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 0.8 }}
						className="flex flex-col items-center gap-5"
					>
						<div
							className="display-title text-3xl uppercase tracking-[0.2em]"
							style={{
								color: "#ffd966",
								textShadow: "0 0 16px rgba(255, 217, 102, 0.45)",
							}}
						>
							{m.camp_title()}
						</div>
						<p className="max-w-xs text-center text-sm text-white/70">
							{m.camp_subtitle()}
						</p>
						<div className="flex gap-3">
							<button
								type="button"
								onClick={onReturn}
								className="inline-flex items-center gap-2 border border-white/40 bg-black px-4 py-2 font-medium text-sm text-white/80 uppercase tracking-wider transition hover:border-white hover:bg-white/10 hover:text-white"
							>
								{m.camp_return_to_city()}
							</button>
							<button
								type="button"
								onClick={onContinue}
								className="inline-flex items-center gap-2 border border-white/40 bg-black px-4 py-2 font-medium text-sm text-white/80 uppercase tracking-wider transition hover:border-white hover:bg-white/10 hover:text-white"
							>
								{m.camp_press_onward()}
							</button>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
