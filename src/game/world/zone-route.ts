import { defaultRng, pickRandom, type Rng } from "../../lib/rng";
import type { MonsterId } from "../monsters";
import {
	type AmbushSchedule,
	rollAmbushSchedule,
	rollSpawnGapMs,
	type ZoneEncounterPlan,
} from "./encounter-schedule";

type StopBody =
	| { kind: "encounter"; monsterId: MonsterId; pack: number | null }
	| { kind: "camp"; campIndex: number }
	| { kind: "exit" };

export type RouteStop = StopBody & { atMs: number; tile: number };

export interface ZoneRoute {
	budgetMs: number;
	tiles: number;
	stops: readonly RouteStop[];
}

type Encounter = Extract<StopBody, { kind: "encounter" }> & { atMs: number };
type RawStop = Exclude<StopBody, { kind: "exit" }> & { atMs: number };

const MS_PER_TILE = 500;
const MIN_TILES = 16;

export function tileCountFor(budgetMs: number): number {
	return Math.max(MIN_TILES, Math.round(budgetMs / MS_PER_TILE) + 1);
}

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

function placeOnTiles(raw: readonly RawStop[], budgetMs: number) {
	const tiles = tileCountFor(budgetMs);
	const tileMs = budgetMs / (tiles - 1);
	const entryMs = (tile: number) => Math.round((tile - 0.5) * tileMs);
	const placed: RouteStop[] = [];
	let prev: RouteStop | null = null;
	for (const stop of raw.toSorted((a, b) => a.atMs - b.atMs)) {
		const ownTile = stop.kind === "camp" || prev?.kind === "camp";
		const tile = Math.max(
			1,
			Math.ceil(stop.atMs / tileMs + 0.5),
			(prev?.tile ?? 0) + (ownTile ? 1 : 0),
		);
		if (tile >= tiles - 1) break;
		prev = { ...stop, tile, atMs: entryMs(tile) };
		placed.push(prev);
	}
	const exit: RouteStop = {
		kind: "exit",
		tile: tiles - 1,
		atMs: entryMs(tiles - 1),
	};
	return { tiles, stops: [...placed, exit] };
}

export function rollZoneRoute(
	input: RouteInput,
	rng: Rng = defaultRng,
): ZoneRoute {
	const encounters = rollEncounters(input, rng);
	const camps: RawStop[] = input.campThresholdsMs.flatMap(
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
	return {
		budgetMs: input.budgetMs,
		...placeOnTiles([...encounters, ...camps], input.budgetMs),
	};
}
