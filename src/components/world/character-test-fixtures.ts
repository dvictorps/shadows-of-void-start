// Shared character-row fixture for the world component tests (StatusCard;
// ShowStatsModal and the sidebar can reuse it).

import type { CharacterRow } from "#/lib/api-types";

/** A level-1 warrior in the city with full life and nothing in the pockets. */
export function characterRow(
	overrides: Partial<CharacterRow> = {},
): CharacterRow {
	return {
		id: 7,
		authUserId: "user-1",
		name: "Tester",
		classId: "warrior",
		level: 1,
		xp: 0,
		hardcore: false,
		dead: false,
		createdAt: 0,
		hpCurrent: 100,
		barrierCurrent: 0,
		potions: 0,
		etherealIncense: 0,
		rubys: 0,
		teleportStones: 0,
		windCrystals: 0,
		currentZoneSession: null,
		currentZoneKills: 0,
		zoneStartedAt: null,
		campThresholdsMs: null,
		inCamp: false,
		lastCampIndex: null,
		currentLocation: "city",
		travelDestination: null,
		travelStartedAt: null,
		travelArrivesAt: null,
		unlockedNodes: ["city"],
		completedZones: [],
		bossKillCounts: {},
		totalBossKills: 0,
		selectedElement: null,
		lastElementSwitchAt: null,
		activeSessionToken: null,
		activeSessionAt: null,
		cachedMaxLife: 100,
		cachedMaxBarrier: 0,
		cachedMagicFind: 0,
		cachedMovementSpeed: 0,
		...overrides,
	};
}
