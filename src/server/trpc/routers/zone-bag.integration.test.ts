import { describe, expect, it } from "vitest";

import { PICK_CAMP_ONLY } from "#/game/loot/bag";
import { SERVER_ERRORS } from "#/lib/server-errors";

import {
	createAccount,
	createPlayableCharacter,
	enterZone,
	expectServerError,
	inventoryOf,
	patchCharacter,
	readCharacter,
	stageBag,
} from "../../test/harness";

describe("zone bag", () => {
	it("stores miniboss drops on the character row, not in items", async () => {
		const account = await createAccount();
		const hero = await createPlayableCharacter(account);
		const zoneSession = await enterZone(account, hero);

		const result = await account.caller.combat.recordKill({
			...hero,
			monsterId: "goblin",
			monsterLevel: 1,
			monsterRarity: "rare",
		});
		// A miniboss always drops at least its guaranteed rare and grants camp.
		expect(result.drops.length).toBeGreaterThanOrEqual(1);
		const row = await readCharacter(hero.characterId);
		expect(row.currentZoneSession).toBe(zoneSession);
		expect(row.inCamp).toBe(true);
		expect(row.completedZones).toContain("forest_starter");
		expect(row.zoneBag.map((e) => e.bagId)).toEqual(
			result.drops.map((d) => d.bagId),
		);
		expect(await inventoryOf(hero.characterId)).toEqual([]);

		const bag = await account.caller.items.zoneBag({
			characterId: hero.characterId,
		});
		expect(bag).toEqual(row.zoneBag);
	});

	it("drops nothing outside a zone visit", async () => {
		const account = await createAccount();
		const hero = await createPlayableCharacter(account);
		const result = await account.caller.combat.recordKill({
			...hero,
			monsterId: "goblin",
			monsterLevel: 1,
			monsterRarity: "rare",
		});
		expect(result.drops).toEqual([]);
		expect((await readCharacter(hero.characterId)).zoneBag).toEqual([]);
	});

	it("caps a non-camp exit at 30% and moves the kept items into the inventory", async () => {
		const account = await createAccount();
		const hero = await createPlayableCharacter(account);
		await enterZone(account, hero);
		const bag = await stageBag(hero.characterId, 10);

		await expectServerError(
			account.caller.items.exitZone({
				...hero,
				keepIds: bag.slice(0, 4).map((e) => e.bagId),
			}),
			"Phase cap exceeded: kept 4 > cap 3 for phase combat",
		);

		const keepIds = [...bag.slice(0, 3).map((e) => e.bagId), "not-in-bag"];
		const exit = await account.caller.items.exitZone({ ...hero, keepIds });
		expect(exit).toMatchObject({ kept: 3, discarded: 7 });
		const inventory = await inventoryOf(hero.characterId);
		// The response carries the new rows, so the client needs no refetch.
		expect(exit.items.map((i) => i.id).toSorted((x, y) => x - y)).toEqual(
			inventory.map((i) => i.id).toSorted((x, y) => x - y),
		);
		expect(
			inventory.map((i) => i.inventorySlot ?? -1).toSorted((x, y) => x - y),
		).toEqual([0, 1, 2]);
		expect(inventory[0]?.data).toEqual(bag[0]?.data);
		expect(inventory[0]?.droppedFrom).toBe("goblin");

		const row = await readCharacter(hero.characterId);
		expect(row.zoneBag).toEqual([]);
		expect(row.currentZoneSession).toBeNull();
	});

	it("keeps nothing twice when the same exit is replayed", async () => {
		const account = await createAccount();
		const hero = await createPlayableCharacter(account);
		await enterZone(account, hero);
		const bag = await stageBag(hero.characterId, 3);
		const keepIds = bag.slice(0, 1).map((e) => e.bagId);

		const [first, second] = await Promise.all([
			account.caller.items.exitZone({ ...hero, keepIds }),
			account.caller.items.exitZone({ ...hero, keepIds }),
		]);
		expect(first.kept + second.kept).toBe(1);
		expect(await inventoryOf(hero.characterId)).toHaveLength(1);
	});

	it("lets a camp pick and discard, once per entry", async () => {
		const account = await createAccount();
		const hero = await createPlayableCharacter(account);
		await enterZone(account, hero);
		const bag = await stageBag(hero.characterId, 4);
		const [a, b, c] = bag.map((e) => e.bagId);

		await expectServerError(
			account.caller.items.pickFromBag({ ...hero, itemIds: [a ?? ""] }),
			PICK_CAMP_ONLY,
		);
		await patchCharacter(hero.characterId, { inCamp: true });

		// Two concurrent picks of the same entry insert one item.
		const picks = await Promise.all([
			account.caller.items.pickFromBag({ ...hero, itemIds: [a ?? ""] }),
			account.caller.items.pickFromBag({ ...hero, itemIds: [a ?? ""] }),
		]);
		expect(picks.map((p) => p.kept).toSorted((x, y) => x - y)).toEqual([0, 1]);
		expect(await inventoryOf(hero.characterId)).toHaveLength(1);

		expect(
			await account.caller.items.discardFromBag({
				...hero,
				itemIds: [b ?? "", a ?? ""],
			}),
		).toEqual({ discarded: 1 });
		const left = (await readCharacter(hero.characterId)).zoneBag.map(
			(e) => e.bagId,
		);
		expect(left).toEqual([c, bag[3]?.bagId]);

		// In camp the whole remaining bag can be kept.
		expect(
			await account.caller.items.exitZone({ ...hero, keepIds: left }),
		).toMatchObject({ kept: 2, discarded: 0 });
		expect(await inventoryOf(hero.characterId)).toHaveLength(3);
	});

	it("wipes the bag on death and on re-entry", async () => {
		const account = await createAccount();
		const hero = await createPlayableCharacter(account);
		await enterZone(account, hero);
		await stageBag(hero.characterId, 2);
		await account.caller.combat.respawnDead(hero);
		const dead = await readCharacter(hero.characterId);
		expect(dead.zoneBag).toEqual([]);
		expect(dead.currentLocation).toBe("city");

		await enterZone(account, hero);
		await stageBag(hero.characterId, 2);
		await account.caller.combat.enterZone({
			...hero,
			zoneId: "forest_starter",
		});
		expect((await readCharacter(hero.characterId)).zoneBag).toEqual([]);
	});

	it("never shows or touches another account's bag", async () => {
		const owner = await createAccount();
		const thief = await createAccount();
		const hero = await createPlayableCharacter(owner);
		await enterZone(owner, hero);
		const bag = await stageBag(hero.characterId, 2);

		expect(
			await thief.caller.items.zoneBag({ characterId: hero.characterId }),
		).toEqual([]);
		await expectServerError(
			thief.caller.items.exitZone({
				...hero,
				keepIds: bag.map((e) => e.bagId),
			}),
			SERVER_ERRORS.notYourCharacter,
		);
	});
});
