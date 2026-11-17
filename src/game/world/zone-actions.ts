import { SERVER_ERRORS } from "#/lib/server-errors";

import { teleportStoneTravelSeconds } from "../combat/constants";
import { rollVisitSchedule, type VisitSchedule } from "./encounter-schedule";
import { ACT_1, findNode, isNodeAccessible } from "./index";
import { computeTravelTime } from "./travel";
import type { WorldNode } from "./types";

export type Decision<Value = object> =
	| { ok: false; error: string }
	| ({ ok: true } & Value);

export const CLEARED_VISIT = {
	currentZoneSession: null,
	zoneStartedAt: null,
	campThresholdsMs: null,
	zoneBudgetMs: null,
	inCamp: false,
	lastCampIndex: null,
	gauntletKills: 0,
} as const;

export interface Whereabouts {
	currentLocation: string;
	travelDestination: string | null;
}

export const ENTER_CAMP_GRACE_MS = 500;
export const TRAVEL_ARRIVAL_GRACE_MS = 1000;

export function resolveZoneEntry(
	zoneId: string,
	where: Whereabouts,
): Decision<{ zone: WorldNode } & VisitSchedule> {
	const zone = findNode(ACT_1, zoneId);
	if (!zone || (zone.kind !== "combat" && zone.kind !== "boss")) {
		return { ok: false, error: `Unknown combat zone: ${zoneId}` };
	}
	if (where.travelDestination !== null) {
		return { ok: false, error: SERVER_ERRORS.travelInProgress };
	}
	if (where.currentLocation !== zoneId) {
		return {
			ok: false,
			error: `Cannot enter ${zoneId} from ${where.currentLocation}`,
		};
	}
	return { ok: true, zone, ...rollVisitSchedule(zone) };
}

export interface CampState {
	currentLocation: string;
	zoneStartedAt: number | null;
	campThresholdsMs: number[] | null;
	inCamp: boolean;
	lastCampIndex: number | null;
}

export function resolveCampEntry(
	state: CampState,
	thresholdIndex: number,
	now: number,
): Decision<{ alreadyInCamp: boolean }> {
	if (state.zoneStartedAt === null)
		return { ok: false, error: SERVER_ERRORS.notInZone };
	if (findNode(ACT_1, state.currentLocation)?.kind === "boss") {
		return { ok: false, error: SERVER_ERRORS.noCampsInBoss };
	}
	const thresholds = state.campThresholdsMs ?? [];
	const threshold = thresholds[thresholdIndex];
	if (threshold === undefined) {
		return { ok: false, error: "Invalid camp threshold" };
	}
	if (state.inCamp) return { ok: true, alreadyInCamp: true };
	if (state.lastCampIndex !== null && thresholdIndex <= state.lastCampIndex) {
		return { ok: false, error: SERVER_ERRORS.campAlreadyUsed };
	}
	if (now - state.zoneStartedAt < threshold - ENTER_CAMP_GRACE_MS) {
		return { ok: false, error: SERVER_ERRORS.campNotReached };
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
		return { ok: false, error: SERVER_ERRORS.alreadyTraveling };
	}
	const fromId = where.currentLocation;
	if (fromId === destinationId) {
		return { ok: false, error: SERVER_ERRORS.alreadyAtDestination };
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

export function resolveTeleport(
	where: TravelCharacter,
	destinationId: string,
	now: number,
): Decision<{ startedAt: number; arrivesAt: number; toCity: boolean }> {
	if (where.teleportStones <= 0)
		return { ok: false, error: SERVER_ERRORS.noTeleportStones };
	const toCity = destinationId === "city";
	if (!toCity) {
		if (where.travelDestination !== null) {
			return { ok: false, error: SERVER_ERRORS.alreadyTraveling };
		}
		if (where.currentLocation === destinationId) {
			return { ok: false, error: SERVER_ERRORS.alreadyAtDestination };
		}
		if (!where.unlockedNodes.includes(destinationId)) {
			return { ok: false, error: SERVER_ERRORS.destinationLocked };
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
