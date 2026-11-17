import { defaultRng, pickRandom, type Rng } from "../../lib/rng";
import type { MonsterId } from "../monsters";
import {
	type AmbushSchedule,
	rollAmbushSchedule,
	rollSpawnGapMs,
	type ZoneEncounterPlan,
} from "./encounter-schedule";

export type RouteStop =
	| {
			kind: "encounter";
			atMs: number;
			monsterId: MonsterId;
			pack: number | null;
	  }
	| { kind: "camp"; atMs: number; campIndex: number }
	| { kind: "exit"; atMs: number };

export interface ZoneRoute {
	budgetMs: number;
	stops: readonly RouteStop[];
}

type Encounter = Extract<RouteStop, { kind: "encounter" }>;

interface RouteInput {
	plan: ZoneEncounterPlan;
	budgetMs: number;
	campThresholdsMs: readonly number[];
	monsterPool: readonly MonsterId[];
}

function rollPack(
	ambush: AmbushSchedule,
	pack: number,
	gapMs: number,
	input: RouteInput,
	rng: Rng,
): Encounter[] {
	const members: Encounter[] = [];
	for (let i = 0; i < ambush.packSize; i++) {
		const atMs = ambush.thresholdMs + i * gapMs;
		const monsterId = pickRandom(input.monsterPool, rng);
		if (atMs >= input.budgetMs || monsterId === undefined) break;
		members.push({ kind: "encounter", atMs, monsterId, pack });
	}
	return members;
}

function rollEncounters(input: RouteInput, rng: Rng): Encounter[] {
	const { plan, budgetMs, monsterPool } = input;
	const ambushes = rollAmbushSchedule(plan, budgetMs, rng);
	const packGapMs = plan.ambushes?.gapWithinPackMs ?? 0;
	const encounters: Encounter[] = [];
	let nextAtMs = rollSpawnGapMs(plan, rng);
	let ambushIndex = 0;
	while (nextAtMs < budgetMs) {
		const ambush = ambushes[ambushIndex];
		if (ambush && ambush.thresholdMs <= nextAtMs) {
			const members = rollPack(ambush, ambushIndex, packGapMs, input, rng);
			encounters.push(...members);
			ambushIndex += 1;
			const last = members.at(-1)?.atMs ?? ambush.thresholdMs;
			nextAtMs = Math.max(nextAtMs, last + rollSpawnGapMs(plan, rng));
			continue;
		}
		const monsterId = pickRandom(monsterPool, rng);
		if (monsterId === undefined) break;
		encounters.push({
			kind: "encounter",
			atMs: nextAtMs,
			monsterId,
			pack: null,
		});
		nextAtMs += rollSpawnGapMs(plan, rng);
	}
	return encounters;
}

function campAfterPacks(atMs: number, encounters: readonly Encounter[]) {
	const inside = encounters.find(
		(e, i) =>
			e.pack !== null &&
			e.atMs < atMs &&
			encounters[i + 1]?.pack === e.pack &&
			encounters[i + 1].atMs >= atMs,
	);
	if (!inside) return atMs;
	const last = encounters.findLast((e) => e.pack === inside.pack);
	return (last?.atMs ?? atMs) + 1;
}

export function rollZoneRoute(
	input: RouteInput,
	rng: Rng = defaultRng,
): ZoneRoute {
	const encounters = rollEncounters(input, rng);
	const camps: RouteStop[] = input.campThresholdsMs.flatMap(
		(thresholdMs, campIndex) =>
			thresholdMs < input.budgetMs
				? [
						{
							kind: "camp" as const,
							atMs: campAfterPacks(thresholdMs, encounters),
							campIndex,
						},
					]
				: [],
	);
	const stops = [...camps, ...encounters].toSorted((a, b) => a.atMs - b.atMs);
	return {
		budgetMs: input.budgetMs,
		stops: [...stops, { kind: "exit", atMs: input.budgetMs }],
	};
}
