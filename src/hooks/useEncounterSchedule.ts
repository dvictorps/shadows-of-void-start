import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
	type MonsterId,
	type MonsterRarity,
	rollMonsterRarity,
} from "#/game/monsters";
import type { CampSource } from "#/game/world";
import {
	rollAmbushRarity,
	type ZoneEncounterPlan,
} from "#/game/world/encounter-schedule";
import {
	type RouteStop,
	rollZoneRoute,
	type ZoneRoute,
} from "#/game/world/zone-route";
import { randInt, seededRng } from "#/lib/rng";

import { useTicker } from "./useTicker";

const CALMARIA_TICK_MS = 100;

const rollRouteSeed = () => randInt(0, 2 ** 31 - 1);

type Params = {
	active: boolean;
	encounterPlan: ZoneEncounterPlan;
	monsterPool: readonly MonsterId[];
	serverVisitId: string | null;
	serverBudgetMs: number | null;
	serverCampThresholdsMs: readonly number[];
	isSearching: boolean;
	postMinibossPauseRef: React.RefObject<boolean>;
	onCampTriggered: (campIndex: number) => void;
	onEncounter: (monsterId: MonsterId, rarity: MonsterRarity) => void;
	onExitReached: () => void;
};

function packContinues(stops: readonly RouteStop[], index: number) {
	const current = stops[index];
	const next = stops[index + 1];
	return (
		current?.kind === "encounter" &&
		current.pack !== null &&
		next?.kind === "encounter" &&
		next.pack === current.pack
	);
}

export function useEncounterSchedule({
	active,
	encounterPlan,
	monsterPool,
	serverVisitId,
	serverBudgetMs,
	serverCampThresholdsMs,
	isSearching,
	postMinibossPauseRef,
	onCampTriggered,
	onEncounter,
	onExitReached,
}: Params) {
	const [routeSeed, setRouteSeed] = useState(rollRouteSeed);
	const visitIdRef = useRef(serverVisitId);
	useLayoutEffect(() => {
		visitIdRef.current = serverVisitId;
	}, [serverVisitId]);
	const [staleVisitId, setStaleVisitId] = useState<string | null>(null);
	const routeReady = serverVisitId !== null && serverVisitId !== staleVisitId;
	const budgetMs = serverBudgetMs ?? encounterPlan.calmariaBudgetSeconds * 1000;
	const route: ZoneRoute = useMemo(
		() =>
			rollZoneRoute(
				{
					plan: encounterPlan,
					budgetMs,
					campThresholdsMs: serverCampThresholdsMs,
					monsterPool,
				},
				seededRng(routeSeed),
			),
		[encounterPlan, budgetMs, serverCampThresholdsMs, monsterPool, routeSeed],
	);
	const routeRef = useRef(route);
	useLayoutEffect(() => {
		routeRef.current = route;
	}, [route]);

	const [calmariaElapsedMs, setCalmariaElapsedMs] = useState(0);
	const calmariaElapsedMsRef = useRef(0);
	const [nextStopIndex, setNextStopIndex] = useState(0);
	const nextStopIndexRef = useRef(0);
	const [ambushActive, setAmbushActive] = useState(false);
	const ambushActiveRef = useRef(false);
	const [campSource, setCampSource] = useState<CampSource>("baked");
	const [incenseCampsMs, setIncenseCampsMs] = useState<readonly number[]>([]);

	const moveTo = useCallback((elapsedMs: number, stopIndex: number) => {
		calmariaElapsedMsRef.current = elapsedMs;
		setCalmariaElapsedMs(elapsedMs);
		nextStopIndexRef.current = stopIndex;
		setNextStopIndex(stopIndex);
	}, []);

	const setAmbush = useCallback((value: boolean) => {
		ambushActiveRef.current = value;
		setAmbushActive(value);
	}, []);

	const resetForMiniboss = useCallback(() => {
		moveTo(0, 0);
		setAmbush(false);
		setIncenseCampsMs([]);
		setRouteSeed(rollRouteSeed());
	}, [moveTo, setAmbush]);

	const startVisit = useCallback(() => {
		resetForMiniboss();
		setCampSource("baked");
		setStaleVisitId(visitIdRef.current);
	}, [resetForMiniboss]);

	const arrive = (stop: RouteStop, index: number) => {
		if (stop.kind === "camp") {
			setCampSource("baked");
			onCampTriggered(stop.campIndex);
			return;
		}
		if (stop.kind === "exit") {
			onExitReached();
			return;
		}
		const ambushPlan = encounterPlan.ambushes;
		const rarity =
			stop.pack !== null && ambushPlan
				? rollAmbushRarity(ambushPlan.magicChance)
				: rollMonsterRarity();
		setAmbush(packContinues(routeRef.current.stops, index));
		onEncounter(stop.monsterId, rarity);
	};

	useTicker(active && isSearching && routeReady, CALMARIA_TICK_MS, () => {
		if (postMinibossPauseRef.current) return;
		const index = nextStopIndexRef.current;
		const stop = routeRef.current.stops[index];
		if (!stop) return;
		const next = calmariaElapsedMsRef.current + CALMARIA_TICK_MS;
		if (next < stop.atMs) {
			moveTo(next, index);
			return;
		}
		moveTo(Math.max(calmariaElapsedMsRef.current, stop.atMs), index + 1);
		arrive(stop, index);
	});

	const isAmbushPackActive = useCallback(() => ambushActiveRef.current, []);

	const startIncenseCamp = useCallback(() => {
		const { stops } = routeRef.current;
		let index = nextStopIndexRef.current;
		while (ambushActiveRef.current && packContinues(stops, index - 1)) {
			index += 1;
		}
		moveTo(calmariaElapsedMsRef.current, index);
		setAmbush(false);
		setCampSource("incense");
		setIncenseCampsMs((prev) => [...prev, calmariaElapsedMsRef.current]);
	}, [moveTo, setAmbush]);

	return {
		route: routeReady ? route : null,
		routeSeed,
		nextStopIndex,
		incenseCampsMs,
		calmariaElapsedMs,
		campSource,
		ambushActive,
		isAmbushPackActive,
		resetForMiniboss,
		startVisit,
		startIncenseCamp,
	};
}
