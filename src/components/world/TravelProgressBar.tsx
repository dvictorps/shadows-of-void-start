import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { m } from "#/paraglide/messages";

type Props = {
	fromName: string;
	toName: string;
	arrivesAtMs: number;
};

/**
 * Bottom-pinned banner with a CSS `scaleX(0 → 1)` fill over the trip's
 * remaining time. Animation params lock on first render so the
 * optimistic→server `arrivesAtMs` swap (~100-200ms diff) doesn't
 * re-anchor the keyframe mid-trip. Caller keys the component on
 * `travelDestination` to guarantee a fresh mount per trip.
 */
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

	const animationRef = useRef<CSSProperties | null>(null);
	if (animationRef.current === null) {
		// Lock on first render; ignore later arrivesAtMs updates so the CSS
		// animation doesn't restart mid-trip.
		const remainingMs = Math.max(100, arrivesAtMs - Date.now());
		animationRef.current = {
			animation: `travel-fill ${remainingMs}ms linear both`,
			transformOrigin: "left center",
		};
	}

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
						className="h-full w-full bg-white"
						style={animationRef.current}
					/>
				</div>
			</div>
		</div>
	);
}
