import { useEffect, useMemo, useState } from "react";
import { m } from "#/paraglide/messages";

type Props = {
	fromName: string;
	toName: string;
	startedAtMs: number;
	arrivesAtMs: number;
};

/**
 * Bottom-pinned banner showing live travel progress.
 *
 * The fill bar runs a pure CSS `transform: scaleX(0 → 1)` keyframe over
 * the *remaining* time, captured once per trip via `useMemo` on
 * `startedAtMs`. On a fresh start it animates over the full duration;
 * on a refresh mid-travel it animates from 0 to 100% over whatever's left.
 *
 * No negative `animation-delay` tricks — those produced a subtle "jump"
 * on mount because the inline style wasn't applied until the second
 * paint. Starting from 0 and only moving forward eliminates the visual
 * artifact entirely. A tiny pause at 0 before the fill starts is the
 * accepted tradeoff per user direction.
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

	const animationStyle = useMemo(() => {
		// Captured once per trip (anchored on startedAtMs). Recomputes only when
		// the player starts a new travel; not on every render of the ticker.
		const remainingMs = Math.max(100, arrivesAtMs - Date.now());
		return {
			animation: `travel-fill ${remainingMs}ms linear forwards`,
			transformOrigin: "left center" as const,
		};
	}, [startedAtMs, arrivesAtMs]);

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
						key={startedAtMs}
						className="h-full w-full bg-yellow-300"
						style={animationStyle}
					/>
				</div>
			</div>
		</div>
	);
}
