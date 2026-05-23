// Camp cinematic — renders inline in the central enemy area (same slot as
// ZoneCompletePanel) so the HUD around can fade out and back in cleanly.
// See CONTEXT.md → Acampamento.

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { translateCampLines } from "#/game/world/i18n";
import { playSfx } from "#/lib/sfx";
import { m } from "#/paraglide/messages";

type Stage = 0 | 1 | 2 | "fading_out" | "panel";

// Last stage is held a hair longer than the first because nothing fades in
// behind it — stage 0's hold is followed by stage 1 entering, which keeps
// the eye occupied; stage 2 is followed by an empty pause that otherwise
// reads as "the last message went by faster than the first".
const STAGE_HOLD_MS: Record<0 | 1 | 2, number> = {
	0: 2000,
	1: 3000,
	2: 3000,
};
const TEXT_EXIT_MS = 1200;
const POST_TEXT_PAUSE_MS = 1000;

const NEXT_STAGE: Record<0 | 1 | 2, Stage> = {
	0: 1,
	1: 2,
	2: "fading_out",
};

type Props = {
	zoneId: string;
	// Baked camps read the zone's CAMP_LINES; incenso-triggered camps read a
	// generic set. See CONTEXT.md → Incenso Etéreo.
	source: "baked" | "incense";
	skip: boolean;
	onReturn: () => void;
	onContinue: () => void;
	// Fires once when the decision panel mounts. Lets the parent time the
	// camp ambience (warm glow) to the panel's arrival.
	onPanelShow: () => void;
};

export default function CampCinematic({
	zoneId,
	source,
	skip,
	onReturn,
	onContinue,
	onPanelShow,
}: Props) {
	const [stage, setStage] = useState<Stage>(0);
	const lines = translateCampLines(zoneId, source);

	useEffect(() => {
		if (skip && stage !== "panel") {
			setStage("panel");
		}
	}, [skip, stage]);

	useEffect(() => {
		// Wind sweeps: one with the first line (open), one with the last line
		// (settle into the camp). Non-exclusive so the two plays can ride
		// each other if the pacing changes later.
		if (stage === 0 || stage === 2) {
			playSfx("vento.wav", { volume: 0.45 });
		}
		if (stage === "panel") {
			onPanelShow();
			return;
		}
		if (stage === "fading_out") {
			const id = window.setTimeout(
				() => setStage("panel"),
				TEXT_EXIT_MS + POST_TEXT_PAUSE_MS,
			);
			return () => window.clearTimeout(id);
		}
		const id = window.setTimeout(
			() =>
				setStage((prev) =>
					prev in NEXT_STAGE ? NEXT_STAGE[prev as 0 | 1 | 2] : prev,
				),
			STAGE_HOLD_MS[stage],
		);
		return () => window.clearTimeout(id);
	}, [stage, onPanelShow]);

	return (
		<div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center">
			<div className="flex h-16 items-center justify-center">
				<AnimatePresence mode="wait">
					{stage !== "panel" && stage !== "fading_out" && (
						<motion.p
							key={stage}
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -6 }}
							transition={{ duration: TEXT_EXIT_MS / 1000, ease: "easeOut" }}
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
