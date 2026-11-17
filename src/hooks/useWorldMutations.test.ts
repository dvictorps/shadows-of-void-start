// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { characterRow } from "#/components/world/character-test-fixtures";
import {
	CHARACTER_ID,
	helmet,
	inventoryRow,
	ring,
	stashRow,
	sword,
} from "#/components/world/item-test-fixtures";
import { teleportStoneTravelSeconds } from "#/game/combat/constants";
import { computeSellPrice } from "#/game/items/sell-price";
import { computeTravelTime } from "#/game/world/travel";
import type { BagEntry } from "#/lib/api-types";

import { renderWithServer } from "./trpc-hook-harness";
import { useWorldMutations } from "./useWorldMutations";

const NOW = 1_000_000;
const MOVEMENT_SPEED = 20;
const VISIT_2 = "00000000-0000-4000-8000-000000000002";

function bagEntry(bagId: string): BagEntry {
	return {
		bagId,
		data: ring(bagId),
		droppedAt: 0,
		droppedFrom: "goblin",
		droppedFromLevel: 1,
	};
}

const IN_ZONE = {
	currentLocation: "forest_starter",
	currentZoneSession: "visit-1",
	zoneStartedAt: 500,
	campThresholdsMs: [1000],
	inCamp: true,
	lastCampIndex: 0,
	unlockedNodes: ["city", "forest_starter"],
};

function setup() {
	const harness = renderWithServer(() =>
		useWorldMutations({
			characterId: CHARACTER_ID,
			movementSpeed: MOVEMENT_SPEED,
		}),
	);
	const mutations = () => harness.result.current;
	return { ...harness, mutations };
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(NOW);
});

afterEach(() => {
	vi.useRealTimers();
});

describe("exitZone", () => {
	it("empties the bag and clears the visit before the server answers, then adds the kept rows", async () => {
		const h = setup();
		const kept = inventoryRow(50, ring("kept"), 1);
		h.seed({
			character: characterRow(IN_ZONE),
			zoneBag: [bagEntry("a"), bagEntry("b")],
			inventory: [inventoryRow(10, sword(), 0)],
		});

		const call = await h.start("items.exitZone", () =>
			h.mutations().exitZone({ characterId: CHARACTER_ID, keepIds: ["a"] }),
		);

		expect(call.input).toMatchObject({
			characterId: CHARACTER_ID,
			keepIds: ["a"],
		});
		expect(call.input.sessionToken).not.toBe("");
		expect(h.cache.zoneBag()).toEqual([]);
		expect(h.cache.character()).toMatchObject({
			currentZoneSession: null,
			zoneStartedAt: null,
			campThresholdsMs: null,
			inCamp: false,
			lastCampIndex: null,
		});
		expect(h.cache.inventory()?.map((row) => row.id)).toEqual([10]);

		await call.resolve({ kept: 1, discarded: 1, items: [kept] });

		expect(h.cache.inventory()?.map((row) => row.id)).toEqual([10, 50]);
	});

	it("restores the bag and the visit when the server refuses, and refetches both", async () => {
		const h = setup();
		const bag = [bagEntry("a")];
		const character = characterRow(IN_ZONE);
		h.seed({ character, zoneBag: bag, inventory: [] });

		const call = await h.start("items.exitZone", () =>
			h.mutations().exitZone({ characterId: CHARACTER_ID, keepIds: [] }),
		);
		const error = await call.reject("Inventário cheio");

		expect(error.message).toBe("Inventário cheio");
		expect(h.cache.zoneBag()).toEqual(bag);
		expect(h.cache.character()).toEqual(character);
		expect(h.isInvalidated(h.cache.keys.zoneBag)).toBe(true);
		expect(h.isInvalidated(h.cache.keys.character)).toBe(true);
	});
});

describe("pickFromBag / discardFromBag", () => {
	it("pickFromBag drops the picked entries, then takes the rows the server returns", async () => {
		const h = setup();
		h.seed({
			character: characterRow(IN_ZONE),
			zoneBag: [bagEntry("a"), bagEntry("b")],
			inventory: [],
		});

		const call = await h.start("items.pickFromBag", () =>
			h.mutations().pickFromBag({ characterId: CHARACTER_ID, itemIds: ["a"] }),
		);
		expect(h.cache.zoneBag()?.map((e) => e.bagId)).toEqual(["b"]);

		await call.resolve({ kept: 1, items: [inventoryRow(60, ring("a"), 0)] });
		expect(h.cache.inventory()?.map((row) => row.id)).toEqual([60]);
	});

	it("discardFromBag puts the entries back when the server refuses", async () => {
		const h = setup();
		const bag = [bagEntry("a"), bagEntry("b")];
		h.seed({ character: characterRow(IN_ZONE), zoneBag: bag });

		const call = await h.start("items.discardFromBag", () =>
			h
				.mutations()
				.discardFromBag({ characterId: CHARACTER_ID, itemIds: ["a", "b"] }),
		);
		expect(h.cache.zoneBag()).toEqual([]);

		await call.reject("Bolsa mudou");
		expect(h.cache.zoneBag()).toEqual(bag);
	});
});

describe("server-only mutations write their answer", () => {
	it("enterCity writes hp and potions and refills the barrier", async () => {
		const h = setup();
		h.seed({
			character: characterRow({ hpCurrent: 3, cachedMaxBarrier: 40 }),
		});
		h.server.reply("combat.enterCity", { hpCurrent: 100, potions: 5 });

		await h.call(() => h.mutations().enterCity({ characterId: CHARACTER_ID }));

		expect(h.cache.character()).toMatchObject({
			hpCurrent: 100,
			potions: 5,
			barrierCurrent: 40,
		});
	});

	it("enterZone opens the visit at full vitals with an empty bag", async () => {
		const h = setup();
		h.seed({
			character: characterRow({
				currentLocation: "forest_starter",
				hpCurrent: 10,
				cachedMaxLife: 120,
				cachedMaxBarrier: 30,
				currentZoneKills: 9,
				inCamp: true,
			}),
			zoneBag: [bagEntry("stale")],
		});
		h.server.reply("combat.enterZone", {
			zoneSession: VISIT_2,
			zoneStartedAt: NOW,
			campThresholdsMs: [5000],
			zoneBudgetMs: 40_000,
		});

		await h.call(() =>
			h
				.mutations()
				.enterZone({ characterId: CHARACTER_ID, zoneId: "forest_starter" }),
		);

		expect(h.cache.character()).toMatchObject({
			currentZoneSession: VISIT_2,
			zoneStartedAt: NOW,
			campThresholdsMs: [5000],
			zoneBudgetMs: 40_000,
			currentZoneKills: 0,
			inCamp: false,
			hpCurrent: 120,
			barrierCurrent: 30,
		});
		expect(h.cache.zoneBag()).toEqual([]);
	});

	it("respawnDead empties the bag and refetches the character", async () => {
		const h = setup();
		h.seed({ character: characterRow(), zoneBag: [bagEntry("a")] });
		h.server.reply("combat.respawnDead", { mode: "softcore", xpLost: 3 });

		await h.call(() =>
			h.mutations().respawnDead({ characterId: CHARACTER_ID }),
		);

		expect(h.cache.zoneBag()).toEqual([]);
		expect(h.isInvalidated(h.cache.keys.character)).toBe(true);
	});

	it("arriveAtTravel moves the character and unlocks the node once", async () => {
		const h = setup();
		h.seed({
			character: characterRow({
				travelDestination: "forest_starter",
				travelStartedAt: 1,
				travelArrivesAt: 2,
			}),
		});
		h.server.reply("combat.arriveAtTravel", { arrivedAt: "forest_starter" });

		await h.call(() =>
			h.mutations().arriveAtTravel({ characterId: CHARACTER_ID }),
		);
		await h.call(() =>
			h.mutations().arriveAtTravel({ characterId: CHARACTER_ID }),
		);

		expect(h.cache.character()).toMatchObject({
			currentLocation: "forest_starter",
			travelDestination: null,
			travelStartedAt: null,
			travelArrivesAt: null,
			unlockedNodes: ["city", "forest_starter"],
		});
	});

	it("switchElement writes the attunement", async () => {
		const h = setup();
		h.seed({ character: characterRow() });
		h.server.reply("combat.switchElement", {
			selectedElement: "fire",
			lastElementSwitchAt: NOW,
		});

		await h.call(() =>
			h
				.mutations()
				.switchElement({ characterId: CHARACTER_ID, element: "fire" }),
		);

		expect(h.cache.character()).toMatchObject({
			selectedElement: "fire",
			lastElementSwitchAt: NOW,
		});
	});
});

describe("startTravel", () => {
	it("predicts the trip with the live movement speed, then takes the server's times", async () => {
		const h = setup();
		h.seed({ character: characterRow({ cachedMovementSpeed: 0 }) });

		const call = await h.start("combat.startTravel", () =>
			h.mutations().startTravel({
				characterId: CHARACTER_ID,
				destinationNodeId: "forest_starter",
			}),
		);
		expect(h.cache.character()).toMatchObject({
			travelDestination: "forest_starter",
			travelStartedAt: NOW,
			travelArrivesAt:
				NOW + Math.round(computeTravelTime(3, MOVEMENT_SPEED) * 1000),
		});

		await call.resolve({
			startedAt: NOW + 5,
			arrivesAt: NOW + 9,
			durationMs: 4,
		});
		expect(h.cache.character()).toMatchObject({
			travelStartedAt: NOW + 5,
			travelArrivesAt: NOW + 9,
		});
	});

	it("paints nothing for a trip the rules refuse, and restores on rejection", async () => {
		const h = setup();
		const character = characterRow();
		h.seed({ character });

		const call = await h.start("combat.startTravel", () =>
			h.mutations().startTravel({
				characterId: CHARACTER_ID,
				destinationNodeId: "castelo",
			}),
		);
		expect(h.cache.character()).toEqual(character);

		await call.reject("No route");
		expect(h.cache.character()).toEqual(character);
	});
});

describe("vendorBuy", () => {
	it("charges and counts the purchase optimistically, then writes the server's totals", async () => {
		const h = setup();
		h.seed({ character: characterRow({ rubys: 100, potions: 1 }) });

		const call = await h.start("vendor.vendorBuy", () =>
			h.mutations().vendorBuy({
				characterId: CHARACTER_ID,
				productId: "potion",
				quantity: 2,
			}),
		);
		expect(h.cache.character()).toMatchObject({ rubys: 80, potions: 3 });

		await call.resolve({ rubys: 77, counterField: "potions", count: 3 });
		expect(h.cache.character()).toMatchObject({ rubys: 77, potions: 3 });
	});

	it("does not paint a purchase the player can't afford, and restores on rejection", async () => {
		const h = setup();
		const character = characterRow({ rubys: 5, potions: 1 });
		h.seed({ character });

		const call = await h.start("vendor.vendorBuy", () =>
			h.mutations().vendorBuy({
				characterId: CHARACTER_ID,
				productId: "potion",
				quantity: 1,
			}),
		);
		expect(h.cache.character()).toEqual(character);

		await call.reject("Rubis insuficientes");
		expect(h.cache.character()).toEqual(character);
	});
});

describe("teleportStone", () => {
	it("spends a stone, starts the jump and empties the bag before the server answers", async () => {
		const h = setup();
		h.seed({
			character: characterRow({ ...IN_ZONE, teleportStones: 2 }),
			zoneBag: [bagEntry("a")],
		});

		const call = await h.start("combat.consumeTeleportStone", () =>
			h.mutations().teleportStone({ characterId: CHARACTER_ID }),
		);
		expect(h.cache.character()).toMatchObject({
			teleportStones: 1,
			travelDestination: "city",
			travelStartedAt: NOW,
			travelArrivesAt: NOW + teleportStoneTravelSeconds("city") * 1000,
			currentZoneSession: null,
		});
		expect(h.cache.zoneBag()).toEqual([]);

		await call.resolve({
			teleportStones: 1,
			travelDestination: "city",
			travelStartedAt: NOW + 1,
			travelArrivesAt: NOW + 2,
			hpCurrent: 100,
			barrierCurrent: 0,
			potions: 4,
		});
		expect(h.cache.character()).toMatchObject({
			travelStartedAt: NOW + 1,
			travelArrivesAt: NOW + 2,
			potions: 4,
		});
	});

	it("restores the stone and the bag when the server refuses", async () => {
		const h = setup();
		const character = characterRow({ ...IN_ZONE, teleportStones: 2 });
		const bag = [bagEntry("a")];
		h.seed({ character, zoneBag: bag });

		const call = await h.start("combat.consumeTeleportStone", () =>
			h.mutations().teleportStone({ characterId: CHARACTER_ID }),
		);
		await call.reject("Sem pedras");

		expect(h.cache.character()).toEqual(character);
		expect(h.cache.zoneBag()).toEqual(bag);
	});
});

describe("vendorSellMany", () => {
	it("removes the sold rows and credits their price, then writes the server's rubys", async () => {
		const h = setup();
		const sold = inventoryRow(10, sword(), 0);
		h.seed({
			character: characterRow({ rubys: 1 }),
			inventory: [sold, inventoryRow(11, ring(), 1)],
		});

		const call = await h.start("vendor.vendorSellMany", () =>
			h
				.mutations()
				.vendorSellMany({ characterId: CHARACTER_ID, itemIds: [10] }),
		);
		expect(h.cache.inventory()?.map((row) => row.id)).toEqual([11]);
		expect(h.cache.character()?.rubys).toBe(1 + computeSellPrice(sold.data));

		await call.resolve({ rubys: 999, priceGained: 998, sold: 1 });
		expect(h.cache.character()?.rubys).toBe(999);
	});

	it("restores the rows and the rubys when the server refuses", async () => {
		const h = setup();
		const character = characterRow({ rubys: 1 });
		const inventory = [inventoryRow(10, sword(), 0)];
		h.seed({ character, inventory });

		const call = await h.start("vendor.vendorSellMany", () =>
			h
				.mutations()
				.vendorSellMany({ characterId: CHARACTER_ID, itemIds: [10] }),
		);
		await call.reject("Venda recusada");

		expect(h.cache.inventory()).toEqual(inventory);
		expect(h.cache.character()).toEqual(character);
	});
});

describe("stash", () => {
	it("depositToStash moves the rows into the next stash slots", async () => {
		const h = setup();
		h.seed({
			character: characterRow(),
			inventory: [inventoryRow(10, sword(), 0), inventoryRow(11, ring(), 1)],
			softcoreStash: [stashRow(20, helmet(), 0)],
		});

		const call = await h.start("stash.depositToStash", () =>
			h
				.mutations()
				.depositToStash({ characterId: CHARACTER_ID, itemIds: [10] }),
		);
		expect(h.cache.inventory()?.map((row) => row.id)).toEqual([11]);
		expect(h.cache.stash("softcore")).toEqual([
			stashRow(20, helmet(), 0),
			expect.objectContaining({
				id: 10,
				locationKind: "stash",
				characterId: null,
				inventorySlot: null,
				stashSlot: 1,
				stashMode: "softcore",
			}),
		]);

		await call.resolve({ deposited: 1, failed: 0 });
		expect(h.isInvalidated(h.cache.keys.inventory)).toBe(false);
	});

	it("depositToStash refetches inventory and stash when some rows failed", async () => {
		const h = setup();
		h.seed({
			character: characterRow(),
			inventory: [inventoryRow(10, sword(), 0)],
			softcoreStash: [],
		});
		h.server.reply("stash.depositToStash", { deposited: 0, failed: 1 });

		await h.call(() =>
			h
				.mutations()
				.depositToStash({ characterId: CHARACTER_ID, itemIds: [10] }),
		);

		expect(h.isInvalidated(h.cache.keys.inventory)).toBe(true);
		expect(h.isInvalidated(h.cache.keys.stash("softcore"))).toBe(true);
	});

	it("withdrawFromStash moves rows back and restores both on rejection", async () => {
		const h = setup();
		const inventory = [inventoryRow(10, sword(), 0)];
		const stash = [stashRow(20, helmet(), 0)];
		h.seed({ character: characterRow(), inventory, softcoreStash: stash });

		const call = await h.start("stash.withdrawFromStash", () =>
			h
				.mutations()
				.withdrawFromStash({ characterId: CHARACTER_ID, itemIds: [20] }),
		);
		expect(h.cache.stash("softcore")).toEqual([]);
		expect(h.cache.inventory()?.at(-1)).toMatchObject({
			id: 20,
			locationKind: "inventory",
			characterId: CHARACTER_ID,
			inventorySlot: 1,
			stashSlot: null,
			stashMode: null,
		});

		await call.reject("Inventário cheio");
		expect(h.cache.inventory()).toEqual(inventory);
		expect(h.cache.stash("softcore")).toEqual(stash);
	});

	it("reorderStash swaps two rows and restores them on rejection", async () => {
		const h = setup();
		const stash = [stashRow(20, helmet(), 0), stashRow(21, ring(), 1)];
		h.seed({ character: characterRow(), softcoreStash: stash });

		const call = await h.start("stash.reorderStash", () =>
			h.mutations().reorderStash({
				characterId: CHARACTER_ID,
				itemId: 20,
				targetSlot: 1,
				swapWithItemId: 21,
			}),
		);
		expect(
			h.cache.stash("softcore")?.map((row) => [row.id, row.stashSlot]),
		).toEqual([
			[21, 0],
			[20, 1],
		]);

		await call.reject("Baú mudou");
		expect(h.cache.stash("softcore")).toEqual(stash);
	});
});
