import { useEffect, useState } from "react";
import { m } from "#/paraglide/messages";

type Props = {
	fromName: string;
	toName: string;
	startedAtMs: number;
	arrivesAtMs: number;
};

/**
 * Bottom-pinned banner showing live travel progress. The fill bar is driven
 * by a pure CSS animation (60fps via the compositor) for smoothness — JS only
 * updates the seconds-remaining counter on a 500ms interval, which is plenty
 * for the second-level resolution shown to the player.
 *
 * `animation-delay` is negative-elapsed so a refresh mid-travel picks up at
 * the correct position instead of restarting from 0%.
 */
export default function TravelProgressBar({
	fromName,
	toName,
	startedAtMs,
	arrivesAtMs,
}: Props) {
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const id = window.setInterval(() => setNow(Date.now()), 500);
		return () => window.clearInterval(id);
	}, []);

	const totalSeconds = Math.max(0.001, (arrivesAtMs - startedAtMs) / 1000);
	const elapsedSeconds = Math.max(0, (now - startedAtMs) / 1000);
	const remainingSeconds = Math.max(0, Math.ceil((arrivesAtMs - now) / 1000));

	return (
		<div className="pointer-events-none absolute right-0 bottom-0 left-0 px-4 pb-4">
			<div className="rounded-md border border-white/40 bg-black/85 px-4 py-2 backdrop-blur-sm">
				<div className="display-title flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-white">
					<span>
						{m.travel_in_progress({ from: fromName, to: toName })}
					</span>
					<span className="text-yellow-300/90">
						{m.travel_seconds_remaining({ seconds: remainingSeconds })}
					</span>
				</div>
				<div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
					<div
						className="h-full bg-yellow-300"
						style={{
							animation: `travel-fill ${totalSeconds}s linear forwards`,
							animationDelay: `-${elapsedSeconds}s`,
						}}
					/>
				</div>
			</div>
		</div>
	);
}
