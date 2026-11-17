import { describe, expect, it } from "vitest";

import { SERVER_ERRORS } from "#/lib/server-errors";

import { ACT_1 } from "../world";
import type { ZoneEncounterPlan } from "../world/encounter-schedule";
import { zoneContextFor } from "../world/zone-context";
import {
	KILL_PACE_GRACE_MS,
	maxPacedKills,
	resolveKillPace,
} from "./kill-pace";

const START = 1_000_000;

const PLAN: ZoneEncounterPlan = {
	calmariaBudgetSeconds: 30,
	gapBetweenSpawns: { min: 1.5, max: 3 },
	campFractions: [0.5],
	ambushes: {
		fractions: [0.4, 0.8],
		packSize: { min: 3, max: 4 },
		gapWithinPackMs: 800,
		magicChance: 0.5,
	},
};

const ZONE = { encounterPlan: PLAN, bossNode: null };
const LAIR = zoneContextFor(ACT_1, "covil_gralfor");
const WARMUP_MS = (LAIR.bossNode?.warmupSeconds ?? 0) * 1000;
const FIGHTS = LAIR.bossNode?.gauntlet.fights ?? 0;

function state(
	over: Partial<Parameters<typeof resolveKillPace>[2]> = {},
): Parameters<typeof resolveKillPace>[2] {
	return {
		zoneStartedAt: START,
		zoneBudgetMs: null,
		currentZoneKills: 0,
		gauntletKills: 0,
		...over,
	};
}

const at = (ms: number) => START + ms - KILL_PACE_GRACE_MS;
const NOT_REACHED = { ok: false, error: SERVER_ERRORS.killNotReached };

describe("maxPacedKills", () => {
	it("allows one spawn per shortest gap, every ambush pack at full size, plus one", () => {
		expect(maxPacedKills(PLAN, 15_000)).toBe(10 + 8 + 1);
	});

	it("allows only the ambushes and one spawn at the start of a visit", () => {
		expect(maxPacedKills(PLAN, 0)).toBe(9);
	});

	it("adds nothing for ambushes in a zone without them", () => {
		const { ambushes: _, ...calm } = PLAN;
		expect(maxPacedKills(calm, 15_000)).toBe(10 + 1);
	});
});

describe("resolveKillPace", () => {
	it("refuses a kill outside a zone visit", () => {
		expect(
			resolveKillPace("normal", ZONE, state({ zoneStartedAt: null }), START),
		).toEqual({ ok: false, error: SERVER_ERRORS.notInZone });
	});

	it("accepts regular kills up to the paced ceiling and refuses the next", () => {
		const ceiling = maxPacedKills(PLAN, 15_000);
		expect(
			resolveKillPace(
				"magic",
				ZONE,
				state({ currentZoneKills: ceiling - 1 }),
				at(15_000),
			),
		).toEqual({ ok: true });
		expect(
			resolveKillPace(
				"magic",
				ZONE,
				state({ currentZoneKills: ceiling }),
				at(15_000),
			),
		).toEqual(NOT_REACHED);
	});

	it("stops the ceiling at the bar's budget, however long the visit lasts", () => {
		const ceiling = maxPacedKills(PLAN, 30_000);
		expect(
			resolveKillPace(
				"normal",
				ZONE,
				state({ currentZoneKills: ceiling }),
				at(3_600_000),
			),
		).toEqual(NOT_REACHED);
	});

	it("reads the visit's rolled budget over the zone's declared one", () => {
		const rolled = state({ zoneBudgetMs: 40_000 });
		expect(resolveKillPace("rare", ZONE, rolled, at(39_999))).toEqual(
			NOT_REACHED,
		);
		expect(resolveKillPace("rare", ZONE, rolled, at(40_000))).toEqual({
			ok: true,
		});
	});

	it("refuses a miniboss before the route could have reached the exit", () => {
		expect(resolveKillPace("rare", ZONE, state(), at(29_999))).toEqual(
			NOT_REACHED,
		);
		expect(resolveKillPace("rare", ZONE, state(), at(30_000))).toEqual({
			ok: true,
		});
	});

	it("refuses a gauntlet rare during the lair's warmup", () => {
		expect(resolveKillPace("rare", LAIR, state(), at(WARMUP_MS - 1))).toEqual(
			NOT_REACHED,
		);
		expect(resolveKillPace("rare", LAIR, state(), at(WARMUP_MS))).toEqual({
			ok: true,
		});
	});

	it("caps the gauntlet rares at the lair's fight count", () => {
		expect(
			resolveKillPace(
				"rare",
				LAIR,
				state({ gauntletKills: FIGHTS }),
				at(WARMUP_MS),
			),
		).toEqual(NOT_REACHED);
	});

	it("counts the boss only after the whole gauntlet", () => {
		expect(
			resolveKillPace(
				"unique",
				LAIR,
				state({ gauntletKills: FIGHTS - 1 }),
				at(WARMUP_MS),
			),
		).toEqual(NOT_REACHED);
		expect(
			resolveKillPace(
				"unique",
				LAIR,
				state({ gauntletKills: FIGHTS }),
				at(WARMUP_MS),
			),
		).toEqual({ ok: true });
	});
});
