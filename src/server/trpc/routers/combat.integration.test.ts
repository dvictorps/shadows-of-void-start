import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_POTIONS } from "#/game/combat/constants";
import { xpToNextLevel } from "#/game/progression/levels";
import { TRAVEL_ARRIVAL_GRACE_MS } from "#/game/world/zone-actions";
import { SERVER_ERRORS } from "#/lib/server-errors";
import { ARRIVAL_RETRY_MS, localTravelEnd } from "#/lib/travel-clock";

import { db } from "../../db/client";
import { items } from "../../db/schema";
import { computeLeaderboardSnapshot } from "../../leaderboard";
import {
	callerFor,
	createAccount,
	createPlayableCharacter,
	enterZone,
	expectServerError,
	patchCharacter,
	readCharacter,
} from "../../test/harness";

describe("combat", () => {
	it("levels up on a kill and refills vitals from the new stat cache", async () => {
		const account = await createAccount();
		const hero = await createPlayableCharacter(account);
		await patchCharacter(hero.characterId, {
			xp: xpToNextLevel(1) - 1,
			hpCurrent: 1,
		});
		const result = await account.caller.combat.recordKill({
			...hero,
			monsterId: "goblin",
			monsterLevel: 1,
			monsterRarity: "normal",
		});
		expect(result.levelsGained).toBe(1);
		const row = await readCharacter(hero.characterId);
		expect(row.level).toBe(2);
		expect(row.hpCurrent).toBe(row.cachedMaxLife);
		expect(result.newMaxLife).toBe(row.cachedMaxLife);
	});

	it("syncs the client's HP on an ordinary kill, clamped, and returns the patch", async () => {
		const account = await createAccount();
		const hero = await createPlayableCharacter(account);
		const { cachedMaxLife } = await readCharacter(hero.characterId);
		const kill = {
			...hero,
			monsterId: "goblin",
			monsterLevel: 1,
			monsterRarity: "normal" as const,
		};

		const hurt = await account.caller.combat.recordKill({
			...kill,
			clientHp: 12.7,
		});
		expect(hurt.character.hpCurrent).toBe(12);
		expect((await readCharacter(hero.characterId)).hpCurrent).toBe(12);

		await account.caller.combat.recordKill({ ...kill, clientHp: 99_999 });
		expect((await readCharacter(hero.characterId)).hpCurrent).toBe(
			cachedMaxLife,
		);

		await patchCharacter(hero.characterId, { hpCurrent: 5 });
		const silent = await account.caller.combat.recordKill(kill);
		expect(silent.character).not.toHaveProperty("hpCurrent");
		expect((await readCharacter(hero.characterId)).hpCurrent).toBe(5);
	});

	it("rejects unknown monsters", async () => {
		const account = await createAccount();
		const hero = await createPlayableCharacter(account);
		await expectServerError(
			account.caller.combat.recordKill({
				...hero,
				monsterId: "dragon",
				monsterLevel: 1,
				monsterRarity: "normal",
			}),
			"Unknown monster: dragon",
		);
	});

	it("bounds a forged monster level and rarity by the character's zone", async () => {
		const account = await createAccount();
		const hero = await createPlayableCharacter(account);
		await enterZone(account, hero, "forest_profunda");
		const kill = {
			...hero,
			monsterId: "goblin",
			monsterRarity: "normal" as const,
		};
		const honest = await account.caller.combat.recordKill({
			...kill,
			monsterLevel: 3,
		});
		const forged = await account.caller.combat.recordKill({
			...kill,
			monsterLevel: 999,
		});
		expect(forged.xpGained).toBe(honest.xpGained);

		await expectServerError(
			account.caller.combat.recordKill({
				...kill,
				monsterLevel: 2,
				monsterRarity: "unique",
			}),
			"Invalid kill: goblin as unique",
		);
		await expectServerError(
			account.caller.combat.recordKill({
				...hero,
				monsterId: "gralfor",
				monsterLevel: 17,
				monsterRarity: "unique",
			}),
			"Invalid kill: gralfor as unique",
		);
		expect((await readCharacter(hero.characterId)).totalBossKills).toBe(0);
	});

	it("clamps synced HP to the cached max and heals with potions", async () => {
		const account = await createAccount();
		const hero = await createPlayableCharacter(account);
		const { cachedMaxLife } = await readCharacter(hero.characterId);

		expect(
			await account.caller.combat.syncHp({ ...hero, hpCurrent: 99_999 }),
		).toEqual({
			hpCurrent: cachedMaxLife,
		});
		await expectServerError(
			account.caller.combat.consumePotion(hero),
			"Already at full HP",
		);
		await account.caller.combat.syncHp({ ...hero, hpCurrent: 1 });
		const drink = await account.caller.combat.consumePotion(hero);
		expect(drink.potions).toBe(4);
		expect(drink.hpCurrent).toBeGreaterThan(1);

		await patchCharacter(hero.characterId, { potions: 0, hpCurrent: 1 });
		await expectServerError(
			account.caller.combat.consumePotion(hero),
			"No potions to use",
		);
		await account.caller.combat.enterCity(hero);
		const healed = await readCharacter(hero.characterId);
		expect(healed.hpCurrent).toBe(cachedMaxLife);
		expect(healed.potions).toBe(3);
	});

	it("travels along a route, unlocks the node and refuses gated zones", async () => {
		const account = await createAccount();
		const hero = await createPlayableCharacter(account);
		await expectServerError(
			account.caller.combat.startTravel({
				...hero,
				destinationNodeId: "pantano",
			}),
			"No route from city to pantano",
		);
		const travel = await account.caller.combat.startTravel({
			...hero,
			destinationNodeId: "forest_starter",
		});
		expect(travel.durationMs).toBeGreaterThan(0);
		await expectServerError(
			account.caller.combat.startTravel({
				...hero,
				destinationNodeId: "forest_starter",
			}),
			"Already traveling",
		);

		await patchCharacter(hero.characterId, { travelArrivesAt: Date.now() });
		expect(await account.caller.combat.arriveAtTravel(hero)).toEqual({
			arrivedAt: "forest_starter",
		});
		expect(await account.caller.combat.arriveAtTravel(hero)).toEqual({
			arrivedAt: "forest_starter",
		});
		const row = await readCharacter(hero.characterId);
		expect(row.unlockedNodes).toEqual(["city", "forest_starter"]);

		await expectServerError(
			account.caller.combat.startTravel({
				...hero,
				destinationNodeId: "forest_profunda",
			}),
			"zone-locked",
		);
	});

	describe("travel arrival", () => {
		async function travellingHero(arrivesInMs: number) {
			const account = await createAccount();
			const hero = await createPlayableCharacter(account);
			await account.caller.combat.startTravel({
				...hero,
				destinationNodeId: "forest_starter",
			});
			await patchCharacter(hero.characterId, {
				travelArrivesAt: Date.now() + arrivesInMs,
			});
			return { arrive: () => account.caller.combat.arriveAtTravel(hero), hero };
		}

		it("refuses an arrival earlier than the grace", async () => {
			const { arrive, hero } = await travellingHero(
				TRAVEL_ARRIVAL_GRACE_MS + 5_000,
			);
			await expectServerError(arrive(), SERVER_ERRORS.travelNotComplete);
			const row = await readCharacter(hero.characterId);
			expect(row.currentLocation).toBe("city");
			expect(row.travelDestination).toBe("forest_starter");
		});

		it("accepts an arrival inside the grace", async () => {
			const { arrive } = await travellingHero(TRAVEL_ARRIVAL_GRACE_MS - 200);
			expect(await arrive()).toEqual({ arrivedAt: "forest_starter" });
		});

		it("accepts an arrival after the trip and unlocks the node", async () => {
			const { arrive, hero } = await travellingHero(-1);
			expect(await arrive()).toEqual({ arrivedAt: "forest_starter" });
			const row = await readCharacter(hero.characterId);
			expect(row.currentLocation).toBe("forest_starter");
			expect(row.travelArrivesAt).toBeNull();
			expect(row.unlockedNodes).toEqual(["city", "forest_starter"]);
		});
	});

	describe("travel arrival under client clock skew", () => {
		const SERVER_START = 1_800_000_000_000;

		beforeEach(() => {
			vi.useFakeTimers({ toFake: ["Date"] });
			vi.setSystemTime(SERVER_START);
		});
		afterEach(() => {
			vi.useRealTimers();
		});

		async function startTrip(clientOffsetMs: number) {
			const account = await createAccount();
			const hero = await createPlayableCharacter(account);
			const travel = await account.caller.combat.startTravel({
				...hero,
				destinationNodeId: "forest_starter",
			});
			const isEarly = (cause: unknown) => {
				if (
					cause instanceof TRPCError &&
					cause.message === SERVER_ERRORS.travelNotComplete
				) {
					return true;
				}
				throw cause;
			};
			const arriveAfter = async (wait: number): Promise<number> => {
				vi.setSystemTime(SERVER_START + wait);
				for (;;) {
					const refused = await account.caller.combat
						.arriveAtTravel(hero)
						.then(() => false, isEarly);
					if (!refused) return Date.now() - SERVER_START;
					vi.setSystemTime(Date.now() + ARRIVAL_RETRY_MS);
				}
			};
			return { travel, clientNow: SERVER_START + clientOffsetMs, arriveAfter };
		}

		it.each([-9_000, 9_000])(
			"waits exactly the trip from the optimistic snapshot (client offset %sms)",
			async (offset) => {
				const { travel, clientNow, arriveAfter } = await startTrip(offset);
				const wait =
					localTravelEnd(clientNow, clientNow, clientNow + travel.durationMs) -
					clientNow;
				expect(wait).toBe(travel.durationMs);
				expect(await arriveAfter(wait)).toBe(travel.durationMs);
			},
		);

		it.each([-9_000, 9_000])(
			"never waits longer than the trip from the server's snapshot (client offset %sms)",
			async (offset) => {
				const { travel, clientNow, arriveAfter } = await startTrip(offset);
				const wait =
					localTravelEnd(clientNow, travel.startedAt, travel.arrivesAt) -
					clientNow;
				expect(wait).toBeLessThanOrEqual(travel.durationMs);
				const arrivedAt = await arriveAfter(wait);
				expect(arrivedAt).toBeLessThanOrEqual(travel.durationMs);
				expect(arrivedAt).toBeGreaterThanOrEqual(
					travel.durationMs - TRAVEL_ARRIVAL_GRACE_MS,
				);
			},
		);
	});

	it("gates camp entry on the rolled threshold", async () => {
		const account = await createAccount();
		const hero = await createPlayableCharacter(account);
		await expectServerError(
			account.caller.combat.enterCamp({ ...hero, thresholdIndex: 0 }),
			"Not in a zone",
		);
		await enterZone(account, hero);
		await expectServerError(
			account.caller.combat.enterCamp({ ...hero, thresholdIndex: 0 }),
			"Camp threshold not reached",
		);
		await patchCharacter(hero.characterId, { zoneStartedAt: 0 });
		expect(
			await account.caller.combat.enterCamp({ ...hero, thresholdIndex: 0 }),
		).toEqual({
			inCamp: true,
		});
		await account.caller.combat.exitCamp(hero);
		await expectServerError(
			account.caller.combat.enterCamp({ ...hero, thresholdIndex: 0 }),
			"Camp threshold already consumed",
		);
	});

	it("spends a teleport stone to return to the city and wipes the zone visit", async () => {
		const account = await createAccount();
		const hero = await createPlayableCharacter(account);
		await expectServerError(
			account.caller.combat.consumeTeleportStone(hero),
			"No teleport stones",
		);
		await enterZone(account, hero);
		await patchCharacter(hero.characterId, { teleportStones: 1, hpCurrent: 1 });
		const result = await account.caller.combat.consumeTeleportStone(hero);
		expect(result.teleportStones).toBe(0);
		const row = await readCharacter(hero.characterId);
		expect(row.travelDestination).toBe("city");
		expect(row.currentZoneSession).toBeNull();
		expect(row.hpCurrent).toBe(row.cachedMaxLife);
	});

	it("kills a hardcore character for good", async () => {
		const account = await createAccount();
		const hero = await createPlayableCharacter(account, "warrior", true);
		expect(await account.caller.combat.respawnDead(hero)).toEqual({
			mode: "hardcore",
			xpLost: 0,
		});
		const row = await readCharacter(hero.characterId);
		expect(row.dead).toBe(true);
		expect(row.activeSessionToken).toBeNull();
		expect(
			await db
				.select()
				.from(items)
				.where(eq(items.characterId, hero.characterId)),
		).toEqual([]);
		expect(await account.caller.characters.list()).toEqual([]);
	});

	it("switches the mage element with a cooldown", async () => {
		const account = await createAccount();
		const mage = await createPlayableCharacter(account, "mage");
		const warrior = await createPlayableCharacter(account);
		await account.caller.combat.switchElement({ ...mage, element: "cold" });
		await expectServerError(
			account.caller.combat.switchElement({ ...mage, element: "lightning" }),
			"Element switch on cooldown",
		);
		await expectServerError(
			account.caller.combat.switchElement({ ...warrior, element: "cold" }),
			"Only mages can switch elements",
		);
		expect((await readCharacter(mage.characterId)).selectedElement).toBe(
			"cold",
		);
	});

	it("drops at most the potion cap", async () => {
		const account = await createAccount();
		const hero = await createPlayableCharacter(account);
		await patchCharacter(hero.characterId, { potions: MAX_POTIONS });
		for (let i = 0; i < 10; i++) {
			await account.caller.combat.recordKill({
				...hero,
				monsterId: "goblin",
				monsterLevel: 1,
				monsterRarity: "normal",
			});
		}
		expect((await readCharacter(hero.characterId)).potions).toBe(MAX_POTIONS);
	});
});

describe("leaderboard", () => {
	it("snapshots the top characters per category and mode", async () => {
		const account = await createAccount();
		const hero = await createPlayableCharacter(account);
		await patchCharacter(hero.characterId, {
			level: 99,
			totalBossKills: 1_000,
		});
		await computeLeaderboardSnapshot(db, 1234);

		const publicCaller = callerFor(null);
		const byLevel = await publicCaller.leaderboard.getSnapshot({
			category: "level",
			mode: "softcore",
		});
		expect(byLevel?.updatedAt).toBe(1234);
		expect(byLevel?.entries[0]?.characterId).toBe(hero.characterId);
		const byBoss = await publicCaller.leaderboard.getSnapshot({
			category: "bossKills",
			mode: "softcore",
		});
		expect(byBoss?.entries[0]?.totalBossKills).toBe(1_000);

		await computeLeaderboardSnapshot(db, 5678);
		const again = await publicCaller.leaderboard.getSnapshot({
			category: "level",
			mode: "hardcore",
		});
		expect(again?.updatedAt).toBe(5678);
	});
});
