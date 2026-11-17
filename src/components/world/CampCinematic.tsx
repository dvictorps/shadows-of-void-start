import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { Button } from "#/components/ui/button";
import type { CampSource } from "#/game/world";
import { translateCampLines } from "#/game/world/i18n";
import { playSfx } from "#/lib/sfx";
import { m } from "#/paraglide/messages";

type Stage = 0 | 1 | 2 | "fading_out" | "panel";

const STAGE_HOLD_MS = {
	0: 2000,
	1: 3000,
	2: 3000,
} satisfies Record<0 | 1 | 2, number>;
const TEXT_EXIT_MS = 1200;
const POST_TEXT_PAUSE_MS = 1000;

const NEXT_STAGE = {
	0: 1,
	1: 2,
	2: "fading_out",
} satisfies Record<0 | 1 | 2, Stage>;

type Props = {
	zoneId: string;
	source: CampSource;
	skip: boolean;
	onReturn: () => void;
	onContinue: () => void;
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

	if (skip && stage !== "panel") setStage("panel");

	useEffect(() => {
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
					prev === 0 || prev === 1 || prev === 2 ? NEXT_STAGE[prev] : prev,
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
							<Button variant="hud" size="hud-lg" caps onClick={onReturn}>
								{m.camp_return_to_city()}
							</Button>
							<Button variant="hud" size="hud-lg" caps onClick={onContinue}>
								{m.camp_press_onward()}
							</Button>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
