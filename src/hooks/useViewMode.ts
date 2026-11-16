// ─────────────────────────────────────────────────────────────────────────────
//  View-mode state machine for the /world route. Owns the "map | city | combat"
//  view + the in-flight `pendingArrival` token, plus the bridge from
//  server-side travel state to client-side view transitions:
//
//    1. Refresh resilience  — if the page loads mid-travel with no pending
//       token, seed it from `travelDestination` so the arrival knows where to
//       transition.
//    2. Auto-arrival        — schedule the `arriveAtTravel` mutation at
//       `travelArrivesAt`. If we're past it already (closed-tab case), fire
//       immediately.
//    3. Auto-enter          — when `arriveAtTravel` answers with the pending
//       node, transition the view to that node's area.
//
//  Setters are deliberately exposed because outgoing transitions
//  (handleEnterNode kicking off travel, handleBackToMap closing combat,
//  handlePlayerDeath dropping the player back in the city) need to drive the
//  state from the route body — this hook owns the *automatic* transitions,
//  not all transitions.
// ─────────────────────────────────────────────────────────────────────────────

import {
	useCallback,
	useEffect,
	useEffectEvent,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

import { ACT_1, findNode } from "#/game/world";

import type { useWorldMutations } from "./useWorldMutations";

type ViewMode = "map" | "city" | "combat";

// The session-wrapped mutations this hook drives; typing them from their
// owner keeps the server shape honest.
type WorldMutations = ReturnType<typeof useWorldMutations>;
type EnterCity = WorldMutations["enterCity"];
type EnterZone = WorldMutations["enterZone"];
type ArriveAtTravel = WorldMutations["arriveAtTravel"];

export function useViewMode({
	characterId,
	travelDestination,
	travelArrivesAt,
	enterCity,
	enterZone,
	arriveAtTravel,
	onEnterNewArea,
}: {
	characterId: number;
	travelDestination: string | null;
	travelArrivesAt: number | null;
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

	const isTraveling = travelDestination !== null && travelArrivesAt !== null;

	// Latest-ref pattern so callers can pass `onEnterNewArea` inline without
	// invalidating `enterDestination`'s memoization each render. Synced in a
	// layout effect (refs can't be written during render), which runs before
	// any click handler or passive effect can call `enterDestination`.
	const onEnterNewAreaRef = useRef(onEnterNewArea);
	useLayoutEffect(() => {
		onEnterNewAreaRef.current = onEnterNewArea;
	});

	// Switches the view, notifies the route and tells the server.
	const enterDestination = useCallback(
		(nodeId: string) => {
			const node = findNode(ACT_1, nodeId);
			if (!node) return;
			const nextView = viewForNode(nodeId);
			if (nextView) setView(nextView);
			onEnterNewAreaRef.current?.();
			if (node.kind === "city") {
				void enterCity({ characterId });
			} else if (node.kind === "combat" || node.kind === "boss") {
				void enterZone({ characterId, zoneId: nodeId });
			}
		},
		[characterId, enterCity, enterZone],
	);

	// Refresh resilience: if we land on this view mid-travel (no client-side
	// pendingArrival yet), seed it from the server so the auto-enter step
	// triggers the correct view transition when the timer fires. Adjusted
	// during render; it converges because the guard fails once seeded.
	if (travelDestination && !pendingArrival) {
		setPendingArrival(travelDestination);
	}

	// Auto-enter, handled where the server's answer arrives: the player is now
	// at `arrivedAt`, and when that's the node we were heading to, the view
	// follows. An Effect Event, so it reads the current pending token.
	const onArrived = useEffectEvent((arrivedAt: string) => {
		if (arrivedAt !== pendingArrival) return;
		setPendingArrival(null);
		enterDestination(arrivedAt);
	});

	// Auto-arrival: schedule arriveAtTravel at travelArrivesAt. If we're already
	// past the arrival time (long-tab-closed case), fire immediately. The
	// timer is the external system here; the arrival itself is handled in the
	// mutation's answer above.
	useEffect(() => {
		if (!isTraveling || travelArrivesAt === null) return;
		const arrive = () => {
			arriveAtTravel({ characterId })
				.then(({ arrivedAt }) => onArrived(arrivedAt))
				.catch(() => {});
		};
		const remaining = travelArrivesAt - Date.now();
		if (remaining <= 0) {
			arrive();
			return;
		}
		const timer = window.setTimeout(arrive, remaining);
		return () => window.clearTimeout(timer);
	}, [isTraveling, travelArrivesAt, arriveAtTravel, characterId]);

	return {
		view,
		setView,
		pendingArrival,
		setPendingArrival,
		isTraveling,
		enterDestination,
	};
}

function viewForNode(nodeId: string): ViewMode | null {
	const node = findNode(ACT_1, nodeId);
	if (!node) return null;
	if (node.kind === "city") return "city";
	if (node.kind === "combat" || node.kind === "boss") return "combat";
	return null;
}
