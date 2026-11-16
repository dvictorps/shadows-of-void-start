import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { MAX_POTIONS } from "#/game/combat/constants";
import { xpToNextLevel } from "#/game/progression/levels";

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
		// Retried arrival is a no-op.
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

		// A second run upserts the same four rows.
		await computeLeaderboardSnapshot(db, 5678);
		const again = await publicCaller.leaderboard.getSnapshot({
			category: "level",
			mode: "hardcore",
		});
		expect(again?.updatedAt).toBe(5678);
	});
});
