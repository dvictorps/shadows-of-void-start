// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { characterRow } from "#/components/world/character-test-fixtures";
import {
	CHARACTER_ID,
	dagger,
	equippedRow,
	greatsword,
	helmet,
	inventoryRow,
	ring,
	shield,
	sword,
} from "#/components/world/item-test-fixtures";

import { renderWithServer } from "./trpc-hook-harness";
import { useInventoryMutations } from "./useInventoryMutations";

function setup() {
	const harness = renderWithServer(() => useInventoryMutations(CHARACTER_ID));
	const mutations = () => harness.result.current;
	const slots = () =>
		harness.cache.inventory()?.map((row) => [row.id, row.inventorySlot]);
	const worn = () =>
		harness.cache.equipped()?.map((row) => [row.id, row.equippedSlot]);
	return { ...harness, mutations, slots, worn };
}

describe("reorderInventory", () => {
	it("swaps two rows before the server answers and keeps them on success", async () => {
		const h = setup();
		h.seed({
			inventory: [inventoryRow(1, sword(), 0), inventoryRow(2, ring(), 3)],
		});

		const call = await h.start("items.reorderInventory", () =>
			h.mutations().reorderInventory({
				characterId: CHARACTER_ID,
				itemId: 1,
				targetSlot: 3,
				swapWithItemId: 2,
			}),
		);
		expect(h.slots()).toEqual([
			[2, 0],
			[1, 3],
		]);

		await call.resolve();
		expect(h.slots()).toEqual([
			[2, 0],
			[1, 3],
		]);
	});

	it("restores the order and refetches when the server refuses", async () => {
		const h = setup();
		const inventory = [inventoryRow(1, sword(), 0), inventoryRow(2, ring(), 3)];
		h.seed({ inventory });

		const call = await h.start("items.reorderInventory", () =>
			h.mutations().reorderInventory({
				characterId: CHARACTER_ID,
				itemId: 1,
				targetSlot: 5,
			}),
		);
		expect(h.slots()).toEqual([
			[2, 3],
			[1, 5],
		]);

		const error = await call.reject("Slot ocupado");
		expect(error.message).toBe("Slot ocupado");
		expect(h.cache.inventory()).toEqual(inventory);
		expect(h.isInvalidated(h.cache.keys.inventory)).toBe(true);
	});
});

describe("equipItem", () => {
	it("moves the item to the slot and the displaced one into the inventory", async () => {
		const h = setup();
		h.seed({
			character: characterRow(),
			inventory: [inventoryRow(1, dagger(), 0), inventoryRow(2, ring(), 1)],
			equipped: [equippedRow(9, sword(), "weapon")],
		});

		const call = await h.start("items.equipItem", () =>
			h.mutations().equipItem({
				characterId: CHARACTER_ID,
				itemId: 1,
				targetSlot: "weapon",
			}),
		);
		expect(h.worn()).toEqual([[1, "weapon"]]);
		expect(h.slots()).toEqual([
			[9, 0],
			[2, 1],
		]);
		expect(h.cache.inventory()?.[0]).toMatchObject({
			locationKind: "inventory",
			equippedSlot: null,
		});

		await call.resolve({ equipped: 1, displaced: 1 });
		expect(h.worn()).toEqual([[1, "weapon"]]);
	});

	it("paints nothing for an equip the rules refuse", async () => {
		const h = setup();
		const inventory = [inventoryRow(1, helmet(), 0)];
		const equipped = [equippedRow(9, sword(), "weapon")];
		h.seed({ character: characterRow(), inventory, equipped });

		const call = await h.start("items.equipItem", () =>
			h.mutations().equipItem({
				characterId: CHARACTER_ID,
				itemId: 1,
				targetSlot: "weapon",
			}),
		);
		expect(h.cache.inventory()).toEqual(inventory);
		expect(h.cache.equipped()).toEqual(equipped);

		await call.reject("Slot errado");
		expect(h.cache.inventory()).toEqual(inventory);
	});

	it("restores inventory and equipment when the server refuses", async () => {
		const h = setup();
		const inventory = [inventoryRow(1, dagger(), 0)];
		const equipped = [equippedRow(9, sword(), "weapon")];
		h.seed({ character: characterRow(), inventory, equipped });

		const call = await h.start("items.equipItem", () =>
			h.mutations().equipItem({
				characterId: CHARACTER_ID,
				itemId: 1,
				targetSlot: "weapon",
			}),
		);
		expect(h.worn()).toEqual([[1, "weapon"]]);

		await call.reject("Nível insuficiente");
		expect(h.cache.inventory()).toEqual(inventory);
		expect(h.cache.equipped()).toEqual(equipped);
	});
});

describe("unequipItem", () => {
	it("sends the item to the next free inventory slot", async () => {
		const h = setup();
		h.seed({
			inventory: [inventoryRow(1, ring(), 0)],
			equipped: [equippedRow(9, greatsword(), "weapon")],
		});

		const call = await h.start("items.unequipItem", () =>
			h.mutations().unequipItem({ characterId: CHARACTER_ID, slot: "weapon" }),
		);
		expect(h.worn()).toEqual([]);
		expect(h.slots()).toEqual([
			[1, 0],
			[9, 1],
		]);

		await call.resolve({ unequipped: 1 });
		expect(h.worn()).toEqual([]);
	});

	it("restores both lists when the server refuses", async () => {
		const h = setup();
		const inventory = [inventoryRow(1, ring(), 0)];
		const equipped = [equippedRow(9, greatsword(), "weapon")];
		h.seed({ inventory, equipped });

		const call = await h.start("items.unequipItem", () =>
			h.mutations().unequipItem({ characterId: CHARACTER_ID, slot: "weapon" }),
		);
		await call.reject("Inventário cheio");

		expect(h.cache.inventory()).toEqual(inventory);
		expect(h.cache.equipped()).toEqual(equipped);
	});
});

describe("swapHands", () => {
	it("swaps main hand and off hand, and swaps back on rejection", async () => {
		const h = setup();
		const equipped = [
			equippedRow(8, sword(), "weapon"),
			equippedRow(9, dagger(), "offhand"),
		];
		h.seed({ equipped });

		const call = await h.start("items.swapHands", () =>
			h.mutations().swapHands({ characterId: CHARACTER_ID }),
		);
		expect(h.worn()).toEqual([
			[8, "offhand"],
			[9, "weapon"],
		]);

		await call.reject("Não pode trocar");
		expect(h.cache.equipped()).toEqual(equipped);
	});

	it("paints nothing without an item in each hand", async () => {
		const h = setup();
		const equipped = [equippedRow(9, shield(), "offhand")];
		h.seed({ equipped });

		const call = await h.start("items.swapHands", () =>
			h.mutations().swapHands({ characterId: CHARACTER_ID }),
		);
		expect(h.cache.equipped()).toEqual(equipped);
		await call.resolve({ swapped: 1 });
	});
});

describe("discardFromInventory", () => {
	it("drops the row before the server answers and restores it on rejection", async () => {
		const h = setup();
		const inventory = [inventoryRow(1, sword(), 0), inventoryRow(2, ring(), 1)];
		h.seed({ inventory });

		const call = await h.start("items.discardFromInventory", () =>
			h
				.mutations()
				.discardFromInventory({ characterId: CHARACTER_ID, itemId: 1 }),
		);
		expect(h.slots()).toEqual([[2, 1]]);

		await call.reject("Item não encontrado");
		expect(h.cache.inventory()).toEqual(inventory);
	});
});
