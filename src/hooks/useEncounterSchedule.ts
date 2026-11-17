import { useCallback, useEffect, useRef, useState } from "react";

import { type MonsterRarity, rollMonsterRarity } from "#/game/monsters";
import type { CampSource } from "#/game/world";
import {
	type AmbushSchedule,
	rollAmbushRarity,
	rollAmbushSchedule,
	rollSpawnGapMs,
	type ZoneEncounterPlan,
} from "#/game/world/encounter-schedule";

import { useTicker } from "./useTicker";

const CALMARIA_TICK_MS = 100;

type Params = {
	active: boolean;
	encounterPlan: ZoneEncounterPlan;
	serverCampThresholdsMs: readonly number[];
	isSearching: boolean;
	postMinibossPauseRef: React.RefObject<boolean>;
	onCampTriggered: (thresholdIndex: number) => void;
};

export function useEncounterSchedule({
	active,
	encounterPlan,
	serverCampThresholdsMs,
	isSearching,
	postMinibossPauseRef,
	onCampTriggered,
}: Params) {
	const ambushPlan = encounterPlan.ambushes;
	const calmariaBudgetMs = encounterPlan.calmariaBudgetSeconds * 1000;

	const [calmariaElapsedMs, setCalmariaElapsedMs] = useState(0);
	const calmariaElapsedMsRef = useRef(0);

	const campThresholdsMsRef = useRef<readonly number[]>(serverCampThresholdsMs);
	useEffect(() => {
		campThresholdsMsRef.current = serverCampThresholdsMs;
	}, [serverCampThresholdsMs]);
	const nextCampIndexRef = useRef(0);

	const ambushScheduleRef = useRef<readonly AmbushSchedule[]>([]);
	const nextAmbushIndexRef = useRef(0);
	const ambushPackRemainingRef = useRef(0);
	const [ambushActive, setAmbushActive] = useState(false);

	const [campSource, setCampSource] = useState<CampSource>("baked");

	const [nextSpawnGapMs, setNextSpawnGapMs] = useState(() =>
		rollSpawnGapMs(encounterPlan),
	);

	const resetSchedule = useCallback((plan: ZoneEncounterPlan) => {
		calmariaElapsedMsRef.current = 0;
		setCalmariaElapsedMs(0);
		nextCampIndexRef.current = 0;
		ambushScheduleRef.current = rollAmbushSchedule(plan);
		nextAmbushIndexRef.current = 0;
		ambushPackRemainingRef.current = 0;
		setNextSpawnGapMs(rollSpawnGapMs(plan));
		setAmbushActive(false);
	}, []);

	const startVisit = useCallback(
		(plan: ZoneEncounterPlan) => {
			resetSchedule(plan);
			setCampSource("baked");
		},
		[resetSchedule],
	);

	const resetForMiniboss = useCallback(
		() => resetSchedule(encounterPlan),
		[resetSchedule, encounterPlan],
	);

	useTicker(active && isSearching, CALMARIA_TICK_MS, () => {
		if (postMinibossPauseRef.current) return;
		const next = calmariaElapsedMsRef.current + CALMARIA_TICK_MS;
		calmariaElapsedMsRef.current = next;
		setCalmariaElapsedMs(next);

		const currentCampIndex = nextCampIndexRef.current;
		const nextCampThreshold = campThresholdsMsRef.current[currentCampIndex];
		if (
			nextCampThreshold !== undefined &&
			next >= nextCampThreshold &&
			next < calmariaBudgetMs
		) {
			nextCampIndexRef.current = currentCampIndex + 1;
			setCampSource("baked");
			onCampTriggered(currentCampIndex);
			return;
		}

		const nextAmbush = ambushScheduleRef.current[nextAmbushIndexRef.current];
		if (
			ambushPlan &&
			nextAmbush !== undefined &&
			next >= nextAmbush.thresholdMs &&
			next < calmariaBudgetMs &&
			ambushPackRemainingRef.current === 0
		) {
			nextAmbushIndexRef.current += 1;
			ambushPackRemainingRef.current = nextAmbush.packSize;
			setAmbushActive(true);
			setNextSpawnGapMs(ambushPlan.gapWithinPackMs);
		}
	});

	const rollSpawnRarity = useCallback((): MonsterRarity => {
		if (calmariaElapsedMsRef.current >= calmariaBudgetMs) return "rare";
		if (ambushPlan && ambushPackRemainingRef.current > 0) {
			return rollAmbushRarity(ambushPlan.magicChance);
		}
		return rollMonsterRarity();
	}, [calmariaBudgetMs, ambushPlan]);

	const isAmbushPackActive = useCallback(
		() => ambushPackRemainingRef.current > 0,
		[],
	);

	const recordSpawn = useCallback(() => {
		if (ambushPackRemainingRef.current > 0) {
			ambushPackRemainingRef.current -= 1;
			if (ambushPackRemainingRef.current <= 0) setAmbushActive(false);
		}
		setNextSpawnGapMs(
			ambushPlan && ambushPackRemainingRef.current > 0
				? ambushPlan.gapWithinPackMs
				: rollSpawnGapMs(encounterPlan),
		);
	}, [ambushPlan, encounterPlan]);

	const cancelAmbush = useCallback(() => {
		ambushPackRemainingRef.current = 0;
		setAmbushActive(false);
		setNextSpawnGapMs(rollSpawnGapMs(encounterPlan));
	}, [encounterPlan]);

	return {
		calmariaElapsedMs,
		calmariaBudgetMs,
		campThresholdsMs: serverCampThresholdsMs,
		campSource,
		ambushActive,
		nextSpawnGapMs,
		rollSpawnRarity,
		isAmbushPackActive,
		recordSpawn,
		resetForMiniboss,
		startVisit,
		cancelAmbush,
		setCampSource,
	};
}
