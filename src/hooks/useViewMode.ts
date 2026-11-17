import {
	useCallback,
	useEffect,
	useEffectEvent,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

import { ACT_1, findNode, type WorldViewMode } from "#/game/world";
import { serverNow, subscribeServerClock } from "#/lib/server-clock";
import { isTravelNotComplete } from "#/lib/server-error-message";
import {
	ARRIVAL_RETRY_MS,
	type TravelSnapshot,
	travelWindow,
} from "#/lib/travel-clock";

import type { useWorldMutations } from "./useWorldMutations";

type WorldMutations = ReturnType<typeof useWorldMutations>;
type EnterCity = WorldMutations["enterCity"];
type EnterZone = WorldMutations["enterZone"];
type ArriveAtTravel = WorldMutations["arriveAtTravel"];

export function useViewMode({
	characterId,
	travelDestination,
	travelStartedAt,
	travelArrivesAt,
	sessionReady,
	enterCity,
	enterZone,
	arriveAtTravel,
	onEnterNewArea,
}: {
	characterId: number;
	travelDestination: string | null;
	travelStartedAt: number | null;
	travelArrivesAt: number | null;
	sessionReady: boolean;
	enterCity: EnterCity;
	enterZone: EnterZone;
	arriveAtTravel: ArriveAtTravel;
	onEnterNewArea?: (nodeId: string) => void;
}) {
	const [view, setView] = useState<WorldViewMode>("map");
	const [pendingArrival, setPendingArrival] = useState<string | null>(null);
	const [trip, setTrip] = useState<TravelSnapshot | null>(null);

	const isTraveling = travelDestination !== null && travelArrivesAt !== null;

	if (!isTraveling && trip !== null) setTrip(null);
	if (isTraveling && trip?.destination !== travelDestination) {
		setTrip({
			destination: travelDestination,
			startedAt: travelStartedAt,
			arrivesAt: travelArrivesAt,
		});
	}

	const onEnterNewAreaRef = useRef(onEnterNewArea);
	useLayoutEffect(() => {
		onEnterNewAreaRef.current = onEnterNewArea;
	});

	const enterDestination = useCallback(
		(nodeId: string) => {
			const node = findNode(ACT_1, nodeId);
			if (!node) return;
			const nextView = viewForNode(nodeId);
			if (nextView) setView(nextView);
			onEnterNewAreaRef.current?.(nodeId);
			if (node.kind === "city") {
				void enterCity({ characterId });
			} else if (node.kind === "combat" || node.kind === "boss") {
				void enterZone({ characterId, zoneId: nodeId });
			}
		},
		[characterId, enterCity, enterZone],
	);

	if (travelDestination && !pendingArrival) {
		setPendingArrival(travelDestination);
	}

	const onArrived = useEffectEvent((arrivedAt: string) => {
		if (arrivedAt !== pendingArrival) return;
		setPendingArrival(null);
		enterDestination(arrivedAt);
	});

	useEffect(() => {
		if (trip === null || !sessionReady) return;
		let cancelled = false;
		let calling = false;
		let timer: number | undefined;
		const schedule = (ms: number) => {
			window.clearTimeout(timer);
			timer = window.setTimeout(() => void arrive(), ms);
		};
		const arm = () => {
			if (calling) return;
			schedule(
				travelWindow(serverNow(), trip.startedAt, trip.arrivesAt).remainingMs,
			);
		};
		const arrive = async () => {
			calling = true;
			try {
				const { arrivedAt } = await arriveAtTravel({ characterId });
				onArrived(arrivedAt);
			} catch (err) {
				if (cancelled || !isTravelNotComplete(err)) return;
				schedule(ARRIVAL_RETRY_MS);
			} finally {
				calling = false;
			}
		};
		arm();
		const unsubscribe = subscribeServerClock(arm);
		return () => {
			cancelled = true;
			window.clearTimeout(timer);
			unsubscribe();
		};
	}, [trip, sessionReady, arriveAtTravel, characterId]);

	return {
		view,
		setView,
		pendingArrival,
		setPendingArrival,
		isTraveling,
		trip,
		enterDestination,
	};
}

function viewForNode(nodeId: string): WorldViewMode | null {
	const node = findNode(ACT_1, nodeId);
	if (!node) return null;
	if (node.kind === "city") return "city";
	if (node.kind === "combat" || node.kind === "boss") return "combat";
	return null;
}
