import { teleportStoneTravelSeconds } from "../combat/constants";
import {
	DEFAULT_ENCOUNTER_PLAN,
	rollCampThresholdsMs,
} from "./encounter-schedule";
import { ACT_1, findNode, isNodeAccessible } from "./index";
import { computeTravelTime } from "./travel";
import type { WorldNode } from "./types";

// Server-authoritative decisions for zone entry, camps and travel
// (CONTEXT.md → Zone states, Travel system). The `combat` procedures load the
// character, call these, and write what they return. `now` is passed in so
// the rules are testable without a clock.

type Decision<Value> = { ok: false; error: string } | ({ ok: true } & Value);

/**
 * The zone-visit columns that exit, death, re-entry and teleport clear. The
 * server adds the bag to it (`CLEARED_ZONE`); the client patches its cached
 * character with it, so a new visit column can't be missed on one side.
 */
export const CLEARED_VISIT = {
	currentZoneSession: null,
	zoneStartedAt: null,
	campThresholdsMs: null,
	inCamp: false,
	lastCampIndex: null,
} as const;

export interface Whereabouts {
	currentLocation: string;
	travelDestination: string | null;
}

// Clock-skew grace windows between the client's timers and the server clock.
// Small on purpose: travel and camps are UX pacing, not hard gates.
export const ENTER_CAMP_GRACE_MS = 500;
export const TRAVEL_ARRIVAL_GRACE_MS = 1000;

export function resolveZoneEntry(
	zoneId: string,
	where: Whereabouts,
): Decision<{ zone: WorldNode; campThresholdsMs: number[] }> {
	const zone = findNode(ACT_1, zoneId);
	if (!zone || (zone.kind !== "combat" && zone.kind !== "boss")) {
		return { ok: false, error: `Unknown combat zone: ${zoneId}` };
	}
	if (where.travelDestination !== null) {
		return { ok: false, error: "Cannot enter — travel in progress" };
	}
	if (where.currentLocation !== zoneId) {
		return {
			ok: false,
			error: `Cannot enter ${zoneId} from ${where.currentLocation}`,
		};
	}
	const campThresholdsMs =
		zone.kind === "boss"
			? []
			: rollCampThresholdsMs(zone.encounterPlan ?? DEFAULT_ENCOUNTER_PLAN);
	return { ok: true, zone, campThresholdsMs };
}

export interface CampState {
	currentLocation: string;
	zoneStartedAt: number | null;
	campThresholdsMs: number[] | null;
	inCamp: boolean;
	lastCampIndex: number | null;
}

/**
 * Time-gated camp entry (threat #3, closed): the camp opens only once the
 * threshold rolled at zone entry has elapsed. `alreadyInCamp` is the
 * idempotent no-op case.
 */
export function resolveCampEntry(
	state: CampState,
	thresholdIndex: number,
	now: number,
): Decision<{ alreadyInCamp: boolean }> {
	if (state.zoneStartedAt === null)
		return { ok: false, error: "Not in a zone" };
	if (findNode(ACT_1, state.currentLocation)?.kind === "boss") {
		return { ok: false, error: "No camps in boss nodes" };
	}
	const thresholds = state.campThresholdsMs ?? [];
	const threshold = thresholds[thresholdIndex];
	if (threshold === undefined) {
		return { ok: false, error: "Invalid camp threshold" };
	}
	if (state.inCamp) return { ok: true, alreadyInCamp: true };
	if (state.lastCampIndex !== null && thresholdIndex <= state.lastCampIndex) {
		return { ok: false, error: "Camp threshold already consumed" };
	}
	if (now - state.zoneStartedAt < threshold - ENTER_CAMP_GRACE_MS) {
		return { ok: false, error: "Camp threshold not reached" };
	}
	return { ok: true, alreadyInCamp: false };
}

export interface TravelCharacter extends Whereabouts {
	completedZones: readonly string[];
	unlockedNodes: readonly string[];
	cachedMovementSpeed: number;
	teleportStones: number;
}

export function resolveTravelStart(
	where: TravelCharacter,
	destinationId: string,
	now: number,
): Decision<{ startedAt: number; arrivesAt: number }> {
	if (where.travelDestination !== null) {
		return { ok: false, error: "Already traveling" };
	}
	const fromId = where.currentLocation;
	if (fromId === destinationId) {
		return { ok: false, error: "Already at destination" };
	}
	const fromNode = findNode(ACT_1, fromId);
	if (!fromNode)
		return { ok: false, error: `Unknown current location: ${fromId}` };
	const connection = fromNode.connections.find((c) => c.id === destinationId);
	if (!connection) {
		return { ok: false, error: `No route from ${fromId} to ${destinationId}` };
	}
	const destNode = findNode(ACT_1, destinationId);
	if (!destNode) {
		return { ok: false, error: `Unknown destination node: ${destinationId}` };
	}
	if (!isNodeAccessible(destNode, where.completedZones)) {
		return { ok: false, error: "zone-locked" };
	}
	const seconds = computeTravelTime(
		connection.distance,
		where.cachedMovementSpeed,
	);
	return {
		ok: true,
		startedAt: now,
		arrivesAt: now + Math.round(seconds * 1000),
	};
}

/**
 * Teleport stone: jump to any already-visited node; the city is the default
 * and also heals. Validation only applies off-city: the city is always a
 * legal destination, even mid-travel.
 */
export function resolveTeleport(
	where: TravelCharacter,
	destinationId: string,
	now: number,
): Decision<{ startedAt: number; arrivesAt: number; toCity: boolean }> {
	if (where.teleportStones <= 0)
		return { ok: false, error: "No teleport stones" };
	const toCity = destinationId === "city";
	if (!toCity) {
		if (where.travelDestination !== null) {
			return { ok: false, error: "Already traveling" };
		}
		if (where.currentLocation === destinationId) {
			return { ok: false, error: "Already at destination" };
		}
		if (!where.unlockedNodes.includes(destinationId)) {
			return { ok: false, error: "Destination not yet unlocked" };
		}
		const destNode = findNode(ACT_1, destinationId);
		if (!destNode) {
			return { ok: false, error: `Unknown destination: ${destinationId}` };
		}
		if (!isNodeAccessible(destNode, where.completedZones)) {
			return { ok: false, error: "zone-locked" };
		}
	}
	return {
		ok: true,
		toCity,
		startedAt: now,
		arrivesAt: now + teleportStoneTravelSeconds(destinationId) * 1000,
	};
}
