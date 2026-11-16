import { describe, expect, it } from "vitest";

import { allSelected, toggleAll, toggleId } from "./item-selection";

const ITEMS = [{ id: 1 }, { id: 2 }];

describe("toggleId", () => {
	it("adds an unselected id and removes a selected one, as a new set", () => {
		const none = new Set<number>();
		const one = toggleId(none, 1);
		expect([...one]).toEqual([1]);
		expect(none.size).toBe(0);
		expect(toggleId(one, 1).size).toBe(0);
	});
});

describe("allSelected / toggleAll", () => {
	it("selects everything until everything is selected, then nothing", () => {
		const some = new Set([1]);
		expect(allSelected(some, ITEMS)).toBe(false);
		const all = toggleAll(some, ITEMS);
		expect([...all]).toEqual([1, 2]);
		expect(allSelected(all, ITEMS)).toBe(true);
		expect(toggleAll(all, ITEMS).size).toBe(0);
	});

	it("never counts an empty side as all selected", () => {
		expect(allSelected(new Set(), [])).toBe(false);
		expect(toggleAll(new Set(), []).size).toBe(0);
	});
});
