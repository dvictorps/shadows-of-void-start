// Camp cinematic overlay. See CONTEXT.md → Acampamento.

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { translateCampLines } from "#/game/world/i18n";
import { m } from "#/paraglide/messages";

type Stage = 0 | 1 | 2 | "modal";

const STAGE_HOLD_MS = 1400;

const NEXT_STAGE: Record<Exclude<Stage, "modal">, Stage> = {
	0: 1,
	1: 2,
	2: "modal",
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
		if (stage === "modal") return;
		const id = window.setTimeout(
			() => setStage((prev) => (prev === "modal" ? prev : NEXT_STAGE[prev])),
			STAGE_HOLD_MS,
		);
		return () => window.clearTimeout(id);
	}, [stage]);

	return (
		<div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm">
			<div className="flex h-32 flex-col items-center justify-center text-center text-white">
				<AnimatePresence mode="wait">
					{stage !== "modal" && (
						<motion.p
							key={stage}
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -6 }}
							transition={{ duration: 0.6, ease: "easeOut" }}
							className="display-title px-8 text-xl tracking-wide text-white/90"
						>
							{lines[stage]}
						</motion.p>
					)}
				</AnimatePresence>
			</div>

			<AnimatePresence>
				{stage === "modal" && (
					<motion.div
						initial={{ opacity: 0, scale: 0.96 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ duration: 0.35, ease: "easeOut" }}
						className="mt-8 flex w-full max-w-md flex-col items-center gap-5 border border-white/40 bg-black p-8 text-center"
					>
						<h2 className="display-title text-2xl uppercase tracking-[0.2em] text-yellow-300">
							{m.camp_title()}
						</h2>
						<p className="text-sm text-white/70">{m.camp_subtitle()}</p>
						<div className="flex w-full flex-col gap-3">
							<button
								type="button"
								onClick={onReturn}
								className="display-title border border-white/40 bg-black px-4 py-3 text-sm uppercase tracking-wider text-white transition hover:border-white hover:bg-white/10"
							>
								{m.camp_return_to_city()}
							</button>
							<button
								type="button"
								onClick={onContinue}
								className="display-title border border-white/40 bg-black px-4 py-3 text-sm uppercase tracking-wider text-white transition hover:border-white hover:bg-white/10"
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
