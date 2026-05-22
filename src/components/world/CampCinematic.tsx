// Camp cinematic — fades in zone-themed ambient text in 3 stages, then
// reveals the decision modal (Retornar à cidade / Seguir em frente).
//
// The cinematic plays while the combat loop's state is "acampamento". Combat
// ticker, calmaria ticker, and spawn delay are all gated on state, so they
// all pause while this is mounted. HP regen / barrier recovery still tick
// (they read the regen stats, not the state), giving the player a small
// sip of recovery for free. See CONTEXT.md → Acampamento.
//
// No audio for this section — the original design called for biome ambient
// sounds, those layer in as a polish pass (see in-progress.md → camp
// cinematic biome audio).

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { m } from "#/paraglide/messages";

type Stage = 0 | 1 | 2 | "modal";

const STAGE_HOLD_MS = 1400;

// Per-zone text. Each zone gets three short lines that fade in over the
// cinematic. Falls back to the forest cadence for any zone not enumerated
// (shouldn't happen with the current act-1 set, but the renderer stays
// safe if a new zone ships before its lines do).
const CAMP_LINES_PT: Record<string, [string, string, string]> = {
	forest_starter: [
		"Os sons da floresta se acalmam...",
		"Um vento corre entre as árvores.",
		"O ar fica mais leve.",
	],
	forest_profunda: [
		"O farfalhar das folhas se aquieta...",
		"A mata se afasta por um instante.",
		"Você encontra um claro.",
	],
	pantano: [
		"A água parada para de borbulhar...",
		"Vagalumes pairam sobre o lodo.",
		"Os sons perturbantes recuam.",
	],
	cripta: [
		"O eco dos seus passos morre.",
		"Apenas silêncio nas paredes.",
		"Uma calma se instala.",
	],
	castelo: [
		"Pedras antigas guardam o silêncio.",
		"O peso do tempo é palpável.",
		"Você encontra um pátio vazio.",
	],
	fenda_vazio: [
		"O ar para de pulsar.",
		"Por um instante, nada existe.",
		"Apenas você e o vácuo.",
	],
};

const CAMP_LINES_EN: Record<string, [string, string, string]> = {
	forest_starter: [
		"The forest sounds settle...",
		"A breeze threads through the trees.",
		"The air feels lighter.",
	],
	forest_profunda: [
		"The rustle of leaves quiets...",
		"The thicket pulls back for a moment.",
		"You find a clearing.",
	],
	pantano: [
		"The standing water stills...",
		"Fireflies rise above the mire.",
		"The unsettling sounds recede.",
	],
	cripta: [
		"The echo of your steps dies.",
		"Just silence in the walls.",
		"A calm settles in.",
	],
	castelo: [
		"Old stones keep the silence.",
		"The weight of time is palpable.",
		"You find an empty courtyard.",
	],
	fenda_vazio: [
		"The air stops pulsing.",
		"For a moment, nothing exists.",
		"Only you and the void.",
	],
};

const FALLBACK_LINES_PT: [string, string, string] = [
	"Os ruídos se acalmam...",
	"O ambiente respira.",
	"O ar fica mais leve.",
];
const FALLBACK_LINES_EN: [string, string, string] = [
	"The sounds settle...",
	"The environment breathes.",
	"The air feels lighter.",
];

function getLines(zoneId: string): [string, string, string] {
	// Paraglide doesn't yet expose a runtime locale getter in this codebase,
	// so we cheap-detect via document.documentElement.lang when available.
	// Defaults to PT (project's baseLocale).
	const lang =
		typeof document !== "undefined" ? document.documentElement.lang : "pt";
	const table = lang === "en" ? CAMP_LINES_EN : CAMP_LINES_PT;
	const fallback = lang === "en" ? FALLBACK_LINES_EN : FALLBACK_LINES_PT;
	return table[zoneId] ?? fallback;
}

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
	const lines = getLines(zoneId);

	useEffect(() => {
		if (stage === "modal") return;
		const id = window.setTimeout(() => {
			setStage((prev) =>
				prev === 0 ? 1 : prev === 1 ? 2 : "modal",
			);
		}, STAGE_HOLD_MS);
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
