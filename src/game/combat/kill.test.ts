import { describe, expect, it } from "vitest";
import { classifyKill, resolveZoneProgress, tallyBossKill } from "./kill";

describe("classifyKill", () => {
	it("normal mob in a combat zone: no camp, standard drops", () => {
		expect(classifyKill("normal", "combat")).toEqual({
			isBossNodeRareKill: false,
			isMinibossKill: false,
			isBossKill: false,
			grantsCampTier: false,
			dropTable: "standard",
		});
	});

	it("magic mob is treated like a normal mob (no camp, standard drops)", () => {
		const c = classifyKill("magic", "combat");
		expect(c.grantsCampTier).toBe(false);
		expect(c.dropTable).toBe("standard");
	});

	it("rare in a normal zone is the zone miniboss: grants camp, miniboss drops", () => {
		expect(classifyKill("rare", "combat")).toEqual({
			isBossNodeRareKill: false,
			isMinibossKill: true,
			isBossKill: false,
			grantsCampTier: true,
			dropTable: "miniboss",
		});
	});

	it("rare inside a boss node is a gauntlet rare: miniboss drops but NO camp tier", () => {
		const c = classifyKill("rare", "boss");
		expect(c.isBossNodeRareKill).toBe(true);
		expect(c.isMinibossKill).toBe(false);
		expect(c.grantsCampTier).toBe(false);
		expect(c.dropTable).toBe("miniboss");
	});

	it("unique is the act boss: grants camp, boss drops", () => {
		expect(classifyKill("unique", "boss")).toEqual({
			isBossNodeRareKill: false,
			isMinibossKill: false,
			isBossKill: true,
			grantsCampTier: true,
			dropTable: "boss",
		});
	});

	it("a unique in a non-boss node still classifies as a boss kill", () => {
		// Defensive: rarity is the source of truth for boss-ness, not the node.
		const c = classifyKill("unique", "combat");
		expect(c.isBossKill).toBe(true);
		expect(c.dropTable).toBe("boss");
	});

	it("an undefined zone kind does not crash and treats rare as a miniboss", () => {
		// recordKill falls back to currentLocation "city" → findNode may miss,
		// leaving zoneKind undefined. A rare must not silently become a gauntlet
		// rare just because the node didn't resolve.
		const c = classifyKill("rare", undefined);
		expect(c.isBossNodeRareKill).toBe(false);
		expect(c.isMinibossKill).toBe(true);
		expect(c.grantsCampTier).toBe(true);
	});

	it("rare in a city node is a miniboss, not a gauntlet rare", () => {
		expect(classifyKill("rare", "city").isMinibossKill).toBe(true);
	});
});

describe("resolveZoneProgress", () => {
	it("a normal kill increments the zone counter and leaves camp untouched", () => {
		expect(
			resolveZoneProgress({
				grantsCampTier: false,
				zoneKind: "combat",
				prevZoneKills: 3,
				prevInCamp: false,
			}),
		).toEqual({
			currentZoneKills: 4,
			inCamp: undefined,
			resetCampSchedule: false,
		});
	});

	it("a non-granting kill while in camp clears the lingering camp flag", () => {
		// Camp was set; the next regular kill (player chose to keep fighting)
		// flips inCamp back to false.
		expect(
			resolveZoneProgress({
				grantsCampTier: false,
				zoneKind: "combat",
				prevZoneKills: 0,
				prevInCamp: true,
			}),
		).toEqual({
			currentZoneKills: 1,
			inCamp: false,
			resetCampSchedule: false,
		});
	});

	it("a miniboss kill in a combat zone grants camp and arms a fresh schedule", () => {
		expect(
			resolveZoneProgress({
				grantsCampTier: true,
				zoneKind: "combat",
				prevZoneKills: 9,
				prevInCamp: false,
			}),
		).toEqual({
			currentZoneKills: 0,
			inCamp: true,
			resetCampSchedule: true,
		});
	});

	it("a boss kill grants camp but does NOT arm a schedule (boss nodes have no camps)", () => {
		expect(
			resolveZoneProgress({
				grantsCampTier: true,
				zoneKind: "boss",
				prevZoneKills: 2,
				prevInCamp: false,
			}),
		).toEqual({
			currentZoneKills: 0,
			inCamp: true,
			resetCampSchedule: false,
		});
	});
});

describe("tallyBossKill", () => {
	it("first kill of a boss with a known prior total increments both", () => {
		expect(tallyBossKill("gralfor", {}, 4)).toEqual({
			bossKillCounts: { gralfor: 1 },
			totalBossKills: 5,
		});
	});

	it("repeat kill bumps the per-boss count and the total", () => {
		expect(tallyBossKill("gralfor", { gralfor: 2 }, 7)).toEqual({
			bossKillCounts: { gralfor: 3 },
			totalBossKills: 8,
		});
	});

	it("preserves other bosses' counts when bumping one", () => {
		const { bossKillCounts } = tallyBossKill("gralfor", { other: 5 }, 5);
		expect(bossKillCounts).toEqual({ other: 5, gralfor: 1 });
	});

	it("legacy char (undefined prior total) re-derives the total from counts, not 0+1", () => {
		// The regression this guards: a pre-backfill char with bossKillCounts
		// already populated must not have its leaderboard total reset to 1.
		expect(tallyBossKill("gralfor", { gralfor: 11 }, undefined)).toEqual({
			bossKillCounts: { gralfor: 12 },
			totalBossKills: 12,
		});
	});

	it("legacy char with multiple bosses sums all counts for the total", () => {
		const { totalBossKills } = tallyBossKill(
			"gralfor",
			{ gralfor: 3, other_boss: 4 },
			undefined,
		);
		expect(totalBossKills).toBe(8); // (3+1) + 4
	});

	it("does not mutate the input counts object", () => {
		const prior = { gralfor: 1 };
		tallyBossKill("gralfor", prior, 1);
		expect(prior).toEqual({ gralfor: 1 });
	});
});
