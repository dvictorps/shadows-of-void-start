// Camp cinematic — renders inline in the central enemy area (same slot as
// ZoneCompletePanel) so the HUD around can fade out and back in cleanly.
// See CONTEXT.md → Acampamento.

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { translateCampLines } from "#/game/world/i18n";
import { m } from "#/paraglide/messages";

type Stage = 0 | 1 | 2 | "fading_out" | "panel";

// Long holds on each ambient line — the moment is supposed to feel earned,
// not skipped through. 3 lines × 5s ≈ 15s of text, then a deliberate gap
// before the decision panel appears.
const STAGE_HOLD_MS = 5000;
const TEXT_EXIT_MS = 1200;
const POST_TEXT_PAUSE_MS = 1000;

const NEXT_STAGE: Record<0 | 1 | 2, Stage> = {
	0: 1,
	1: 2,
	2: "fading_out",
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
		// `fading_out` waits for the last line's exit animation to fully play,
		// then sits an extra POST_TEXT_PAUSE_MS in silence before the panel
		// fades in. Lets the comfy moment breathe.
		if (stage === "fading_out") {
			const id = window.setTimeout(
				() => setStage("panel"),
				TEXT_EXIT_MS + POST_TEXT_PAUSE_MS,
			);
			return () => window.clearTimeout(id);
		}
		const id = window.setTimeout(
			() => setStage((prev) => (prev in NEXT_STAGE ? NEXT_STAGE[prev as 0 | 1 | 2] : prev)),
			STAGE_HOLD_MS,
		);
		return () => window.clearTimeout(id);
	}, [stage]);

	return (
		<div className="relative z-10 flex flex-col items-center gap-8 px-6 text-center">
			<div className="flex h-24 items-center justify-center">
				<AnimatePresence mode="wait">
					{stage !== "panel" && stage !== "fading_out" && (
						<motion.p
							key={stage}
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -8 }}
							transition={{ duration: TEXT_EXIT_MS / 1000, ease: "easeOut" }}
							className="display-title max-w-2xl text-3xl tracking-wide text-amber-50/90"
							style={{
								textShadow: "0 0 24px rgba(252, 165, 60, 0.35)",
							}}
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
							className="display-title text-5xl uppercase tracking-[0.2em]"
							style={{
								color: "#ffd966",
								textShadow: "0 0 20px rgba(255, 217, 102, 0.55)",
							}}
						>
							{m.camp_title()}
						</div>
						<p className="max-w-sm text-center text-base text-amber-50/80">
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
