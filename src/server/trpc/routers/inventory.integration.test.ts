import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { findStarterItem } from "#/game/items/starter-gear";
import type { GeneratedItem } from "#/game/items/types";
import { SERVER_ERRORS } from "#/lib/server-errors";

import { db } from "../../db/client";
import { items } from "../../db/schema";
import {
	createAccount,
	createPlayableCharacter,
	expectServerError,
	inventoryOf,
	patchCharacter,
	readCharacter,
} from "../../test/harness";

function starter(id: string): GeneratedItem {
	const item = findStarterItem(id);
	if (!item) throw new Error(`missing starter item ${id}`);
	return item;
}

async function giveItem(
	authUserId: string,
	characterId: number,
	data: GeneratedItem,
	inventorySlot: number,
): Promise<number> {
	const [row] = await db
		.insert(items)
		.values({
			authUserId,
			locationKind: "inventory",
			characterId,
			inventorySlot,
			data,
			droppedAt: Date.now(),
		})
		.returning({ id: items.id });
	if (!row) throw new Error("insert failed");
	return row.id;
}

async function equippedOf(characterId: number) {
	return db
		.select()
		.from(items)
		.where(
			and(
				eq(items.characterId, characterId),
				eq(items.locationKind, "equipped"),
			),
		);
}

describe("inventory and equipment", () => {
	it("equips from the inventory, displacing the occupant, and refreshes the stat cache", async () => {
		const account = await createAccount();
		const hero = await createPlayableCharacter(account, "rogue");
		const oldWeapon = (await equippedOf(hero.characterId)).find(
			(e) => e.equippedSlot === "weapon",
		);
		const sword = await giveItem(
			account.session.user.id,
			hero.characterId,
			starter("starter:rusty_sword"),
			0,
		);
		await patchCharacter(hero.characterId, { cachedMaxLife: 1 });

		expect(
			await account.caller.items.equipItem({
				...hero,
				itemId: sword,
				targetSlot: "weapon",
			}),
		).toEqual({ equipped: 1, displaced: 1 });

		const weapon = (await equippedOf(hero.characterId)).find(
			(e) => e.equippedSlot === "weapon",
		);
		expect(weapon?.id).toBe(sword);
		const inventory = await inventoryOf(hero.characterId);
		expect(inventory.map((i) => [i.id, i.inventorySlot])).toEqual([
			[oldWeapon?.id, 0],
		]);
		expect(
			(await readCharacter(hero.characterId)).cachedMaxLife,
		).toBeGreaterThan(1);
	});

	it("rejects equips into the wrong slot and other characters' items", async () => {
		const account = await createAccount();
		const hero = await createPlayableCharacter(account);
		const other = await createPlayableCharacter(account, "mage");
		const vest = await giveItem(
			account.session.user.id,
			other.characterId,
			starter("starter:tattered_leather_vest"),
			0,
		);
		await expectServerError(
			account.caller.items.equipItem({
				...hero,
				itemId: vest,
				targetSlot: "chestplate",
			}),
			SERVER_ERRORS.notYourItem,
		);
		const own = await giveItem(
			account.session.user.id,
			hero.characterId,
			starter("starter:tattered_leather_vest"),
			0,
		);
		await expectServerError(
			account.caller.items.equipItem({
				...hero,
				itemId: own,
				targetSlot: "weapon",
			}),
			/wrong-slot/,
		);
	});

	it("unequips into the first free slot and rejects an empty slot", async () => {
		const account = await createAccount();
		const hero = await createPlayableCharacter(account);
		await account.caller.items.unequipItem({ ...hero, slot: "weapon" });
		expect(
			(await inventoryOf(hero.characterId)).map((i) => i.inventorySlot),
		).toEqual([0]);
		await expectServerError(
			account.caller.items.unequipItem({ ...hero, slot: "weapon" }),
			SERVER_ERRORS.slotEmpty,
		);
	});

	it("reorders, swaps and discards inventory items", async () => {
		const account = await createAccount();
		const hero = await createPlayableCharacter(account);
		const uid = account.session.user.id;
		const a = await giveItem(
			uid,
			hero.characterId,
			starter("starter:rusty_sword"),
			0,
		);
		const b = await giveItem(
			uid,
			hero.characterId,
			starter("starter:rusty_dagger"),
			1,
		);

		await account.caller.items.reorderInventory({
			...hero,
			itemId: a,
			targetSlot: 1,
			swapWithItemId: b,
		});
		const slots = new Map(
			(await inventoryOf(hero.characterId)).map((i) => [i.id, i.inventorySlot]),
		);
		expect(slots.get(a)).toBe(1);
		expect(slots.get(b)).toBe(0);

		await expectServerError(
			account.caller.items.reorderInventory({
				...hero,
				itemId: a,
				targetSlot: 60,
			}),
			"Invalid slot: 60",
		);
		await account.caller.items.discardFromInventory({ ...hero, itemId: a });
		await expectServerError(
			account.caller.items.discardFromInventory({ ...hero, itemId: a }),
			SERVER_ERRORS.itemNotFound,
		);
		expect(
			await account.caller.items.inventory({ characterId: hero.characterId }),
		).toHaveLength(1);
	});
});

describe("stash", () => {
	it("deposits and withdraws in the city only, within the character's mode", async () => {
		const account = await createAccount();
		const uid = account.session.user.id;
		const hero = await createPlayableCharacter(account);
		const hardcore = await createPlayableCharacter(account, "rogue", true);
		const sword = await giveItem(
			uid,
			hero.characterId,
			starter("starter:rusty_sword"),
			0,
		);

		expect(
			await account.caller.stash.depositToStash({
				...hero,
				itemIds: [sword, 999_999],
			}),
		).toEqual({ deposited: 1, failed: 1 });
		expect(
			await account.caller.items.stash({ stashMode: "softcore" }),
		).toHaveLength(1);
		expect(await account.caller.items.stash({ stashMode: "hardcore" })).toEqual(
			[],
		);

		expect(
			await account.caller.stash.withdrawFromStash({
				...hardcore,
				itemIds: [sword],
			}),
		).toEqual({ withdrawn: 0, failed: 1 });

		await patchCharacter(hero.characterId, {
			currentLocation: "forest_starter",
		});
		await expectServerError(
			account.caller.stash.withdrawFromStash({ ...hero, itemIds: [sword] }),
			"Must be in the city",
		);
		await patchCharacter(hero.characterId, { currentLocation: "city" });
		expect(
			await account.caller.stash.withdrawFromStash({
				...hero,
				itemIds: [sword],
			}),
		).toEqual({ withdrawn: 1, failed: 0 });
		expect((await inventoryOf(hero.characterId)).map((i) => i.id)).toEqual([
			sword,
		]);
	});
});

describe("vendor", () => {
	it("charges catalog prices and enforces the potion cap", async () => {
		const account = await createAccount();
		const hero = await createPlayableCharacter(account);
		await patchCharacter(hero.characterId, { rubys: 100, potions: 5 });

		expect(
			await account.caller.vendor.vendorBuy({
				...hero,
				productId: "potion",
				quantity: 2,
			}),
		).toEqual({ rubys: 80, counterField: "potions", count: 7 });
		await expectServerError(
			account.caller.vendor.vendorBuy({
				...hero,
				productId: "potion",
				quantity: 4,
			}),
			"potion cap reached",
		);
		await expectServerError(
			account.caller.vendor.vendorBuy({
				...hero,
				productId: "teleport_stone",
				quantity: 3,
			}),
			"Not enough rubys",
		);
		await expectServerError(
			account.caller.vendor.vendorBuy({
				...hero,
				productId: "potion",
				quantity: 1.5,
			}),
			"Quantity must be a positive integer",
		);
	});

	it("pays a sale once, even when it is replayed concurrently", async () => {
		const account = await createAccount();
		const hero = await createPlayableCharacter(account);
		const sword = await giveItem(
			account.session.user.id,
			hero.characterId,
			starter("starter:rusty_sword"),
			0,
		);
		const results = await Promise.allSettled([
			account.caller.vendor.vendorSellMany({ ...hero, itemIds: [sword] }),
			account.caller.vendor.vendorSellMany({ ...hero, itemIds: [sword] }),
		]);
		const paid = results.flatMap((r) =>
			r.status === "fulfilled" ? [r.value] : [],
		);
		expect(paid).toHaveLength(1);
		const { rubys } = await readCharacter(hero.characterId);
		expect(rubys).toBe(paid[0]?.priceGained);
		expect(await inventoryOf(hero.characterId)).toEqual([]);
	});
});
