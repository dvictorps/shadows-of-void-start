import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

import { m } from "#/paraglide/messages";

type Props = {
	fromName: string;
	toName: string;
	arrivesAtMs: number;
};

export default function TravelProgressBar({
	fromName,
	toName,
	arrivesAtMs,
}: Props) {
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const id = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(id);
	}, []);

	const [animationStyle] = useState<CSSProperties>(() => ({
		animation: `travel-fill ${Math.max(100, arrivesAtMs - Date.now())}ms linear both`,
		transformOrigin: "left center",
	}));

	const remainingSeconds = Math.max(0, Math.ceil((arrivesAtMs - now) / 1000));

	return (
		<div className="pointer-events-none absolute right-0 bottom-0 left-0 px-4 pb-4">
			<div className="rounded-md border border-white/40 bg-black/85 px-4 py-2 backdrop-blur-sm">
				<div className="display-title flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-white">
					<span>{m.travel_in_progress({ from: fromName, to: toName })}</span>
					<span className="text-yellow-300/90">
						{m.travel_seconds_remaining({ seconds: remainingSeconds })}
					</span>
				</div>
				<div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
					<div className="h-full w-full bg-white" style={animationStyle} />
				</div>
			</div>
		</div>
	);
}
