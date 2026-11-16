import { describe, expect, it } from "vitest";

import { m } from "#/paraglide/messages";

import { elementName } from "./element-name";

describe("elementName", () => {
	it.each([
		["physical", m.element_physical()],
		["cold", m.element_cold()],
		["Cold", m.element_cold()],
		["fire", m.element_fire()],
		["Fire", m.element_fire()],
		["lightning", m.element_lightning()],
		["Lightning", m.element_lightning()],
		["void", m.element_void()],
		["Void", m.element_void()],
	])("names %s", (element, expected) => {
		expect(elementName(element)).toBe(expected);
	});

	it("returns an unknown element as given", () => {
		expect(elementName("Chaos")).toBe("Chaos");
		expect(elementName("toString")).toBe("toString");
	});
});
