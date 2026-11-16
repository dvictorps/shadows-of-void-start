import { describe, expect, it } from "vitest";

import { INVENTORY_MAX_SLOTS } from "../inventory/constants";
import { resolveBagExit, resolveBagPick } from "./bag";

const bag = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];

describe("resolveBagExit", () => {
	it("keeps only ids that are in the bag", () => {
		expect(
			resolveBagExit({
				bagIds: bag,
				keepIds: ["a", "zzz"],
				inCamp: false,
				inventoryUsed: 0,
			}),
		).toEqual({ ok: true, keep: ["a"] });
	});

	it("caps a non-camp exit at 30% of the bag", () => {
		expect(
			resolveBagExit({
				bagIds: bag,
				keepIds: ["a", "b", "c", "d"],
				inCamp: false,
				inventoryUsed: 0,
			}),
		).toEqual({
			ok: false,
			error: "Phase cap exceeded: kept 4 > cap 3 for phase combat",
		});
		expect(
			resolveBagExit({
				bagIds: bag,
				keepIds: bag,
				inCamp: true,
				inventoryUsed: 0,
			}),
		).toEqual({ ok: true, keep: bag });
	});

	it("refuses to overflow the inventory", () => {
		const result = resolveBagExit({
			bagIds: bag,
			keepIds: ["a"],
			inCamp: true,
			inventoryUsed: INVENTORY_MAX_SLOTS,
		});
		expect(result).toEqual({
			ok: false,
			error: `Inventory overflow: ${INVENTORY_MAX_SLOTS + 1} > ${INVENTORY_MAX_SLOTS}`,
		});
	});
});

describe("resolveBagPick", () => {
	it("dedupes, skips unknown ids and stops at the free room", () => {
		expect(
			resolveBagPick({
				bagIds: bag,
				pickIds: ["a", "a", "nope", "b", "c"],
				inventoryUsed: INVENTORY_MAX_SLOTS - 2,
			}),
		).toEqual(["a", "b"]);
	});
});
