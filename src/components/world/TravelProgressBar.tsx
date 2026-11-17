import type { CSSProperties } from "react";
import { useState } from "react";

import { useTicker } from "#/hooks/useTicker";
import { serverNow, useServerClockOffset } from "#/lib/server-clock";
import { travelWindow } from "#/lib/travel-clock";
import { m } from "#/paraglide/messages";

type Props = {
	fromName: string;
	toName: string;
	startedAtMs: number | null;
	arrivesAtMs: number;
};

const MIN_FILL_MS = 100;

export default function TravelProgressBar(props: Props) {
	const clockOffset = useServerClockOffset();
	return <TravelProgressBarAt key={clockOffset} {...props} />;
}

function TravelProgressBarAt({
	fromName,
	toName,
	startedAtMs,
	arrivesAtMs,
}: Props) {
	const [{ endAt, animationStyle }] = useState(() => {
		const { remainingMs, durationMs } = travelWindow(
			serverNow(),
			startedAtMs,
			arrivesAtMs,
		);
		const fillMs = Math.max(MIN_FILL_MS, durationMs);
		const style: CSSProperties = {
			animation: `travel-fill ${fillMs}ms linear ${remainingMs - fillMs}ms both`,
			transformOrigin: "left center",
		};
		return { endAt: Date.now() + remainingMs, animationStyle: style };
	});
	const secondsLeft = () => Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
	const [remainingSeconds, setRemainingSeconds] = useState(secondsLeft);

	useTicker(remainingSeconds > 0, 250, () =>
		setRemainingSeconds(secondsLeft()),
	);

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
