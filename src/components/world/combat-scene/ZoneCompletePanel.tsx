import { motion } from "framer-motion";

import { Button } from "#/components/ui/button";
import { m } from "#/paraglide/messages";

export default function ZoneCompletePanel({
	onContinue,
	onRetreat,
	showContinue = true,
}: {
	onContinue: () => void;
	onRetreat: () => void;
	showContinue?: boolean;
}) {
	return (
		<motion.div
			className="flex flex-col items-center gap-5 px-6"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ duration: 0.3 }}
		>
			<div
				className="display-title text-4xl uppercase tracking-[0.2em]"
				style={{
					color: "#ffd966",
					textShadow: "0 0 16px rgba(255, 217, 102, 0.45)",
				}}
			>
				{m.zone_complete_title()}
			</div>
			<p className="max-w-sm text-balance text-center text-sm text-white/70">
				{m.miniboss_modal_body()}
			</p>
			<div className="flex gap-3">
				{showContinue && (
					<Button variant="hud" size="hud-lg" caps onClick={onContinue}>
						{m.miniboss_modal_continue()}
					</Button>
				)}
				<Button variant="hud" size="hud-lg" caps onClick={onRetreat}>
					{m.miniboss_modal_retreat()}
				</Button>
			</div>
		</motion.div>
	);
}
