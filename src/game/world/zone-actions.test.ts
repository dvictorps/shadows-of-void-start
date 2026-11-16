import { describe, expect, it } from "vitest";

import {
	ENTER_CAMP_GRACE_MS,
	resolveCampEntry,
	resolveTeleport,
	resolveZoneEntry,
} from "./zone-actions";

const inForest = {
	currentLocation: "forest_starter",
	travelDestination: null,
	completedZones: [],
	unlockedNodes: ["city"],
	cachedMovementSpeed: 0,
	teleportStones: 1,
};

describe("resolveZoneEntry", () => {
	it("only enters the zone the character stands in", () => {
		expect(resolveZoneEntry("forest_starter", inForest)).toMatchObject({
			ok: true,
		});
		expect(resolveZoneEntry("pantano", inForest)).toEqual({
			ok: false,
			error: "Cannot enter pantano from forest_starter",
		});
		expect(resolveZoneEntry("city", inForest)).toEqual({
			ok: false,
			error: "Unknown combat zone: city",
		});
	});
});

describe("resolveCampEntry", () => {
	const state = {
		currentLocation: "forest_starter",
		zoneStartedAt: 10_000,
		campThresholdsMs: [5_000],
		inCamp: false,
		lastCampIndex: null,
	};

	it("opens within the grace window and not before", () => {
		const edge = 10_000 + 5_000 - ENTER_CAMP_GRACE_MS;
		expect(resolveCampEntry(state, 0, edge)).toEqual({
			ok: true,
			alreadyInCamp: false,
		});
		expect(resolveCampEntry(state, 0, edge - 1)).toEqual({
			ok: false,
			error: "Camp threshold not reached",
		});
		expect(resolveCampEntry(state, 1, edge)).toEqual({
			ok: false,
			error: "Invalid camp threshold",
		});
	});
});

describe("resolveTeleport", () => {
	it("always allows the city, but only unlocked nodes elsewhere", () => {
		expect(resolveTeleport(inForest, "city", 0)).toMatchObject({
			ok: true,
			toCity: true,
		});
		expect(resolveTeleport(inForest, "pantano", 0)).toEqual({
			ok: false,
			error: "Destination not yet unlocked",
		});
		expect(
			resolveTeleport({ ...inForest, teleportStones: 0 }, "city", 0),
		).toEqual({
			ok: false,
			error: "No teleport stones",
		});
	});
});
