// ─────────────────────────────────────────────────────────────────────────────
//  View-mode state machine for the /world route. Owns the "map | city | combat"
//  view + the in-flight `pendingArrival` token, plus the three effects that
//  bridge server-side travel state into client-side view transitions:
//
//    1. Refresh resilience  — if the page loads mid-travel with no pending
//       token, seed it from `travelDestination` so the arrival effect knows
//       where to transition.
//    2. Auto-arrival        — schedule the `arriveAtTravel` mutation at
//       `travelArrivesAt`. If we're past it already (closed-tab case), fire
//       immediately.
//    3. Auto-enter          — when the server confirms arrival and the player
//       is now at the pending node, transition the view to that node's area.
//
//  Setters are deliberately exposed because outgoing transitions
//  (handleEnterNode kicking off travel, handleBackToMap closing combat,
//  handlePlayerDeath dropping the player back in the city) need to drive the
//  state from the route body — this hook owns the *automatic* transitions,
//  not all transitions.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { ACT_1, findNode } from "#/game/world";
import type { Id } from "../../convex/_generated/dataModel";

export type ViewMode = "map" | "city" | "combat";

type EnterCity = (args: { characterId: Id<"characters"> }) => Promise<unknown>;
type EnterZone = (args: {
	characterId: Id<"characters">;
	zoneId: string;
}) => Promise<unknown>;
type ArriveAtTravel = (args: {
	characterId: Id<"characters">;
}) => Promise<unknown>;

export function useViewMode({
	characterId,
	currentLocation,
	travelDestination,
	travelArrivesAt,
	enterCity,
	enterZone,
	arriveAtTravel,
	onEnterNewArea,
}: {
	characterId: Id<"characters">;
	currentLocation: string;
	travelDestination: string | undefined;
	travelArrivesAt: number | undefined;
	enterCity: EnterCity;
	enterZone: EnterZone;
	arriveAtTravel: ArriveAtTravel;
	// Fires whenever the player enters a node (city or combat). Used by the
	// route to clear the death-log message so it doesn't bleed across zones.
	onEnterNewArea?: () => void;
}) {
	const [view, setView] = useState<ViewMode>("map");
	// Set when the player clicks a node that requires travel — the auto-arrival
	// effect transitions the view to this node's area when travel completes.
	// Also reseeded from `travelDestination` on mount so a refresh mid-travel
	// still arrives in the right view.
	const [pendingArrival, setPendingArrival] = useState<string | null>(null);

	const isTraveling =
		travelDestination !== undefined && travelArrivesAt !== undefined;

	// Latest-ref pattern so callers can pass `onEnterNewArea` inline without
	// invalidating `enterDestination`'s memoization each render.
	const onEnterNewAreaRef = useRef(onEnterNewArea);
	onEnterNewAreaRef.current = onEnterNewArea;

	const enterDestination = useCallback(
		(nodeId: string) => {
			const node = findNode(ACT_1, nodeId);
			if (!node) return;
			onEnterNewAreaRef.current?.();
			if (node.kind === "city") {
				setView("city");
				void enterCity({ characterId });
			} else if (node.kind === "combat" || node.kind === "boss") {
				setView("combat");
				void enterZone({ characterId, zoneId: nodeId });
			}
		},
		[characterId, enterCity, enterZone],
	);

	// Refresh resilience: if we land on this view mid-travel (no client-side
	// pendingArrival yet), seed it from the server so the auto-arrival effect
	// triggers the correct view transition when the timer fires.
	useEffect(() => {
		if (travelDestination && !pendingArrival) {
			setPendingArrival(travelDestination);
		}
	}, [travelDestination, pendingArrival]);

	// Auto-arrival: schedule arriveAtTravel at travelArrivesAt. If we're already
	// past the arrival time (long-tab-closed case), fire immediately.
	useEffect(() => {
		if (!isTraveling || travelArrivesAt === undefined) return;
		const remaining = travelArrivesAt - Date.now();
		if (remaining <= 0) {
			void arriveAtTravel({ characterId });
			return;
		}
		const timer = window.setTimeout(() => {
			void arriveAtTravel({ characterId });
		}, remaining);
		return () => window.clearTimeout(timer);
	}, [isTraveling, travelArrivesAt, arriveAtTravel, characterId]);

	// Auto-enter destination after the server confirms arrival. Detects the
	// transition "was traveling → not traveling AND now at the pendingArrival".
	useEffect(() => {
		if (!pendingArrival || isTraveling) return;
		if (currentLocation !== pendingArrival) return;
		enterDestination(pendingArrival);
		setPendingArrival(null);
	}, [pendingArrival, isTraveling, currentLocation, enterDestination]);

	return {
		view,
		setView,
		pendingArrival,
		setPendingArrival,
		isTraveling,
		enterDestination,
	};
}
