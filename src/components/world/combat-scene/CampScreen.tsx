import { Button } from "#/components/ui/button";
import type { CampSource } from "#/game/world";
import { translateCampLine } from "#/game/world/i18n";
import { m } from "#/paraglide/messages";

import CampFire from "./CampFire";

export default function CampScreen({
	zoneId,
	source,
	onReturn,
	onContinue,
}: {
	zoneId: string;
	source: CampSource;
	onReturn: () => void;
	onContinue: () => void;
}) {
	return (
		<div className="absolute inset-0">
			<CampFire />
			<div className="pointer-events-none relative z-10 flex h-full flex-col items-center justify-between px-6 pt-16 pb-6 text-center">
				<div className="flex flex-col items-center gap-3">
					<div
						className="display-title text-3xl uppercase tracking-[0.2em]"
						style={{
							color: "#ffd966",
							textShadow: "0 0 16px rgba(255, 217, 102, 0.45)",
						}}
					>
						{m.camp_title()}
					</div>
					<p className="max-w-xs text-sm text-white/70">
						{translateCampLine(zoneId, source)}
					</p>
				</div>
				<div className="pointer-events-auto flex gap-3">
					<Button variant="hud" size="hud-lg" caps onClick={onReturn}>
						{m.camp_return_to_city()}
					</Button>
					<Button variant="hud" size="hud-lg" caps onClick={onContinue}>
						{m.camp_press_onward()}
					</Button>
				</div>
			</div>
		</div>
	);
}
