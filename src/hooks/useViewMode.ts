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

import {
	useCallback,
	useEffect,
	useEffectEvent,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

import { ACT_1, findNode } from "#/game/world";

import type { Id } from "../../convex/_generated/dataModel";
import type { useWorldMutations } from "./useWorldMutations";

type ViewMode = "map" | "city" | "combat";

// The session-wrapped Convex mutations this hook drives; their results are
// ignored, but typing them from their owner keeps the server shape honest.
type WorldMutations = ReturnType<typeof useWorldMutations>;
type EnterCity = WorldMutations["enterCity"];
type EnterZone = WorldMutations["enterZone"];
type ArriveAtTravel = WorldMutations["arriveAtTravel"];

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
	// invalidating `enterDestination`'s memoization each render. Synced in a
	// layout effect (refs can't be written during render), which runs before
	// any click handler or passive effect can call `enterDestination`.
	const onEnterNewAreaRef = useRef(onEnterNewArea);
	useLayoutEffect(() => {
		onEnterNewAreaRef.current = onEnterNewArea;
	});

	// The non-state half of entering a node: notify the route and tell the
	// server. Split from the view switch so the auto-enter path can switch the
	// view during render and run only these side effects after commit.
	const notifyAndRequestEnter = useCallback(
		(nodeId: string) => {
			const node = findNode(ACT_1, nodeId);
			if (!node) return;
			onEnterNewAreaRef.current?.();
			if (node.kind === "city") {
				void enterCity({ characterId });
			} else if (node.kind === "combat" || node.kind === "boss") {
				void enterZone({ characterId, zoneId: nodeId });
			}
		},
		[characterId, enterCity, enterZone],
	);

	const enterDestination = useCallback(
		(nodeId: string) => {
			const nextView = viewForNode(nodeId);
			if (nextView) setView(nextView);
			notifyAndRequestEnter(nodeId);
		},
		[notifyAndRequestEnter],
	);

	// Refresh resilience: if we land on this view mid-travel (no client-side
	// pendingArrival yet), seed it from the server so the auto-enter step
	// triggers the correct view transition when the timer fires. Adjusted
	// during render; it converges because the guard fails once seeded.
	if (travelDestination && !pendingArrival) {
		setPendingArrival(travelDestination);
	}

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
	// transition "was traveling → not traveling AND now at the pendingArrival"
	// during render, consumes the token there, and records the arrival as a
	// fresh object so the effect below fires exactly once per arrival.
	const [arrival, setArrival] = useState<{ nodeId: string } | null>(null);
	if (pendingArrival && !isTraveling && currentLocation === pendingArrival) {
		setPendingArrival(null);
		const nextView = viewForNode(pendingArrival);
		if (nextView) setView(nextView);
		setArrival({ nodeId: pendingArrival });
	}

	// Entering calls server mutations, so it runs after commit. Read through an
	// Effect Event so a new callback identity never re-enters the same arrival.
	// The view itself switches during render (above), one commit before these
	// callbacks run. Accepted: the parent's area-change resets (e.g. clearing
	// the death log) land a frame later; nothing is lost, only briefly stale.
	const requestArrivedEnter = useEffectEvent((nodeId: string) => {
		notifyAndRequestEnter(nodeId);
	});
	useEffect(() => {
		// oxlint-disable-next-line you-might-not-need-an-effect/no-event-handler -- the triggering "event" is Convex's reactive query pushing the new `currentLocation`; no client handler exists to call this from. Convex-transport-shaped: revisit in the Cloudflare migration, where arrival can be handled where the response arrives.
		if (arrival) requestArrivedEnter(arrival.nodeId);
	}, [arrival]);

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
