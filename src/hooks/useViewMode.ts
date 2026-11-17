import {
	useCallback,
	useEffect,
	useEffectEvent,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

import { ACT_1, findNode, type WorldViewMode } from "#/game/world";

import type { useWorldMutations } from "./useWorldMutations";

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
	onEnterNewArea?: (nodeId: string) => void;
}) {
	const [view, setView] = useState<WorldViewMode>("map");
	const [pendingArrival, setPendingArrival] = useState<string | null>(null);

	const isTraveling = travelDestination !== null && travelArrivesAt !== null;

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

function viewForNode(nodeId: string): WorldViewMode | null {
	const node = findNode(ACT_1, nodeId);
	if (!node) return null;
	if (node.kind === "city") return "city";
	if (node.kind === "combat" || node.kind === "boss") return "combat";
	return null;
}
