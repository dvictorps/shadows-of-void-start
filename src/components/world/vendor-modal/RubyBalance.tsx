import { AnimatePresence, motion } from "framer-motion";

import RubyIcon from "#/components/game/RubyIcon";
import Tooltip from "#/components/ui/tooltip";
import { m } from "#/paraglide/messages";

export type RubyDelta = { id: string; amount: number; sign: "+" | "-" };

/**
 * The vendor's ruby balance, with the optimistic deltas floating up from it
 * (stacked when several fire close together).
 */
export default function RubyBalance({
	rubys,
	deltas,
}: {
	rubys: number;
	deltas: readonly RubyDelta[];
}) {
	return (
		<Tooltip content={m.ruby_tooltip()}>
			<div className="display-title relative flex items-center justify-end gap-2 px-1 text-xl uppercase tracking-[0.15em] text-yellow-300 tabular-nums">
				<RubyIcon className="h-6 w-6" />
				{rubys}
				<div className="pointer-events-none absolute right-0 bottom-full mb-1 flex flex-col items-end">
					<AnimatePresence>
						{deltas.map((d) => (
							<motion.div
								key={d.id}
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -16 }}
								transition={{ duration: 0.4, ease: "easeOut" }}
								className={`display-title flex items-center gap-1 px-1 font-bold text-base tabular-nums tracking-wider ${
									d.sign === "+" ? "text-emerald-300" : "text-red-400"
								}`}
								style={{ textShadow: "0 2px 4px rgba(0,0,0,0.9)" }}
							>
								{d.sign}
								{d.amount}
								<RubyIcon className="h-4 w-4" />
							</motion.div>
						))}
					</AnimatePresence>
				</div>
			</div>
		</Tooltip>
	);
}
