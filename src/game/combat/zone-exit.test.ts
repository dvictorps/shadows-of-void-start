import { describe, expect, it } from "vitest";

import { planZoneExit } from "./zone-exit";

describe("planZoneExit", () => {
	it("waits while the bag is still loading", () => {
		expect(planZoneExit(undefined, "camp")).toEqual({ kind: "wait" });
	});

	it("leaves straight away with an empty bag", () => {
		expect(planZoneExit(0, "combat")).toEqual({ kind: "leave" });
	});

	it("keeps the whole bag from a camp", () => {
		expect(planZoneExit(7, "camp")).toEqual({ kind: "pick", keepCap: 7 });
	});

	it("caps at 30% (minimum 1) outside a camp", () => {
		expect(planZoneExit(10, "exploration")).toEqual({
			kind: "pick",
			keepCap: 3,
		});
		expect(planZoneExit(2, "combat")).toEqual({ kind: "pick", keepCap: 1 });
	});
});
