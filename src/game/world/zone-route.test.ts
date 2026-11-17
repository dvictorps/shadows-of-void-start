import { describe, expect, it } from "vitest";

import { seededRng } from "#/lib/rng";

import type { ZoneEncounterPlan } from "./encounter-schedule";
import { rollZoneRoute } from "./zone-route";

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

describe("rollZoneRoute", () => {
	it("lays the route on half-second tiles and ends on the exit tile", () => {
		const { stops, tiles, budgetMs } = route();
		expect(budgetMs).toBe(10_000);
		expect(tiles).toBe(21);
		expect(stops.map((s) => s.tile)).toEqual([
			3, 5, 7, 9, 11, 13, 15, 17, 19, 20,
		]);
		expect(stops.at(-1)).toEqual({ kind: "exit", tile: 20, atMs: 9750 });
	});

	it("triggers each stop as the walker enters its tile", () => {
		for (const stop of route({ plan: AMBUSH_PLAN }).stops) {
			expect(stop.atMs).toBe((stop.tile - 0.5) * 500);
		}
	});

	it("draws every encounter from the zone's monster pool", () => {
		const monsters = route().stops.flatMap((s) =>
			s.kind === "encounter" ? [s.monsterId] : [],
		);
		expect(monsters.length).toBeGreaterThan(0);
		for (const id of monsters) expect(POOL).toContain(id);
	});

	it("fits more tiles and encounters in a longer rolled budget", () => {
		const short = route({ budgetMs: 8000 });
		const long = route({ budgetMs: 12_000 });
		expect(long.tiles).toBeGreaterThan(short.tiles);
		expect(long.stops.length).toBeGreaterThan(short.stops.length);
	});

	it("places the server's camps on their tile, never before the threshold, and drops one past the exit", () => {
		const { stops } = route({ campThresholdsMs: [4500, 10_000] });
		const camps = stops.filter((s) => s.kind === "camp");
		expect(camps).toEqual([
			{ kind: "camp", campIndex: 0, tile: 10, atMs: 4750 },
		]);
		const camp = stops.findIndex((s) => s.kind === "camp");
		expect(stops[camp - 1]).toMatchObject({ kind: "encounter", tile: 9 });
		expect(stops[camp + 1]).toMatchObject({ kind: "encounter", tile: 11 });
	});

	it("never puts an enemy on a camp's tile", () => {
		for (let seed = 0; seed < 50; seed++) {
			const { stops } = route(
				{ plan: AMBUSH_PLAN, campThresholdsMs: [2500, 5000, 7500] },
				seed,
			);
			const campTiles = new Set(
				stops.filter((s) => s.kind === "camp").map((s) => s.tile),
			);
			const enemyTiles = stops.flatMap((s) =>
				s.kind === "encounter" ? [s.tile] : [],
			);
			expect(enemyTiles.filter((t) => campTiles.has(t))).toEqual([]);
		}
	});

	it("clusters an ambush pack on neighbouring tiles, in order", () => {
		const { stops } = route({ plan: AMBUSH_PLAN });
		const pack = stops.filter((s) => s.kind === "encounter" && s.pack === 0);
		expect(pack).toHaveLength(3);
		const tiles = pack.map((s) => s.tile);
		expect(tiles.toSorted((a, b) => a - b)).toEqual(tiles);
		expect((tiles.at(-1) ?? 0) - tiles[0]).toBeLessThanOrEqual(1);
	});

	it("keeps a camp that lands inside a pack after the whole pack", () => {
		const base = route({ plan: AMBUSH_PLAN }).stops;
		const pack = base.filter((s) => s.kind === "encounter" && s.pack === 0);
		const middle = pack[1].atMs + 100;
		const { stops } = route({ plan: AMBUSH_PLAN, campThresholdsMs: [middle] });
		const camp = stops.findIndex((s) => s.kind === "camp");
		const lastMember = stops.findLastIndex(
			(s) => s.kind === "encounter" && s.pack === 0,
		);
		expect(camp).toBeGreaterThan(lastMember);
	});

	it("is reproducible under the same seed", () => {
		expect(route({ plan: AMBUSH_PLAN }, 7)).toEqual(
			route({ plan: AMBUSH_PLAN }, 7),
		);
	});

	it("leaves only the exit when the pool is empty", () => {
		expect(route({ monsterPool: [] }).stops).toEqual([
			{ kind: "exit", tile: 20, atMs: 9750 },
		]);
	});
});
