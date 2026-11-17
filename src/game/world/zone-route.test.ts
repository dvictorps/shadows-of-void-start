import { describe, expect, it } from "vitest";

import { seededRng } from "#/lib/rng";

import type { ZoneEncounterPlan } from "./encounter-schedule";
import { type RouteStop, rollZoneRoute } from "./zone-route";

const PLAN: ZoneEncounterPlan = {
	calmariaBudgetSeconds: 10,
	gapBetweenSpawns: { min: 1, max: 1 },
	campFractions: [0.5],
};

const AMBUSH_PLAN: ZoneEncounterPlan = {
	...PLAN,
	ambushes: {
		fractions: [0.3],
		packSize: { min: 3, max: 3 },
		gapWithinPackMs: 200,
		magicChance: 1,
	},
};

const POOL = ["goblin", "slime"] as const;

function route(
	over: Partial<Parameters<typeof rollZoneRoute>[0]> = {},
	seed = 1,
) {
	return rollZoneRoute(
		{
			plan: PLAN,
			budgetMs: 10_000,
			campThresholdsMs: [],
			monsterPool: POOL,
			...over,
		},
		seededRng(seed),
	);
}

const kinds = (stops: readonly RouteStop[]) => stops.map((s) => s.kind);

describe("rollZoneRoute", () => {
	it("spaces encounters by the spawn gap and ends at the exit", () => {
		const { stops, budgetMs } = route();
		expect(budgetMs).toBe(10_000);
		expect(stops.map((s) => s.atMs)).toEqual([
			1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10_000,
		]);
		expect(stops.at(-1)).toEqual({ kind: "exit", atMs: 10_000 });
	});

	it("draws every encounter from the zone's monster pool", () => {
		const monsters = route().stops.flatMap((s) =>
			s.kind === "encounter" ? [s.monsterId] : [],
		);
		expect(monsters.length).toBeGreaterThan(0);
		for (const id of monsters) expect(POOL).toContain(id);
	});

	it("fits more encounters in a longer rolled budget", () => {
		const short = route({ budgetMs: 8000 }).stops.length;
		const long = route({ budgetMs: 12_000 }).stops.length;
		expect(long).toBeGreaterThan(short);
	});

	it("places the server's camps in order, and drops one at or past the exit", () => {
		const { stops } = route({ campThresholdsMs: [4500, 10_000] });
		const camps = stops.filter((s) => s.kind === "camp");
		expect(camps).toEqual([{ kind: "camp", atMs: 4500, campIndex: 0 }]);
		expect(kinds(stops).slice(3, 6)).toEqual([
			"encounter",
			"camp",
			"encounter",
		]);
	});

	it("clusters an ambush pack at its threshold, one in-pack gap apart", () => {
		const { stops } = route({ plan: AMBUSH_PLAN });
		const pack = stops.filter((s) => s.kind === "encounter" && s.pack === 0);
		expect(pack).toHaveLength(3);
		const [first, second, third] = pack.map((s) => s.atMs);
		expect(second - first).toBe(200);
		expect(third - second).toBe(200);
	});

	it("pushes a camp that lands inside a pack to right after it", () => {
		const { stops } = route({ plan: AMBUSH_PLAN });
		const pack = stops.filter((s) => s.kind === "encounter" && s.pack === 0);
		const middle = pack[1].atMs - 50;
		const withCamp = route({ plan: AMBUSH_PLAN, campThresholdsMs: [middle] });
		const camp = withCamp.stops.find((s) => s.kind === "camp");
		expect(camp?.atMs).toBe((pack.at(-1)?.atMs ?? 0) + 1);
	});

	it("is reproducible under the same seed", () => {
		expect(route({ plan: AMBUSH_PLAN }, 7)).toEqual(
			route({ plan: AMBUSH_PLAN }, 7),
		);
	});

	it("leaves only the exit when the pool is empty", () => {
		expect(route({ monsterPool: [] }).stops).toEqual([
			{ kind: "exit", atMs: 10_000 },
		]);
	});
});
