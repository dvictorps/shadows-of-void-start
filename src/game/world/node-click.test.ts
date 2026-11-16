import { describe, expect, it } from "vitest";

import { ACT_1, findNode } from ".";
import { translateNodeName } from "./i18n";
import { resolveNodeClick } from "./node-click";

type Input = Parameters<typeof resolveNodeClick>[0];

const BASE: Input = {
	act: ACT_1,
	nodeId: "forest_starter",
	currentLocation: "city",
	unlockedNodeIds: new Set(["city", "forest_starter", "pantano"]),
	teleportStones: 2,
};

const click = (over: Partial<Input>) => resolveNodeClick({ ...BASE, ...over });
const pantanoName = translateNodeName(findNode(ACT_1, "pantano")!);

describe("resolveNodeClick", () => {
	it("re-enters the node the player stands on", () => {
		expect(click({ nodeId: "city" })).toEqual({ kind: "reenter" });
	});

	it("walks to a connected node, stones or not", () => {
		expect(click({})).toEqual({ kind: "walk" });
		expect(click({ teleportStones: 0 })).toEqual({ kind: "walk" });
	});

	it("offers a stone jump to an unlocked, unconnected node", () => {
		expect(click({ nodeId: "pantano" })).toEqual({
			kind: "stone",
			destinationName: pantanoName,
			stones: 2,
		});
	});

	it("has no route without a stone", () => {
		expect(click({ nodeId: "pantano", teleportStones: 0 })).toEqual({
			kind: "no-route",
			destinationName: pantanoName,
		});
	});

	it("has no route to a node never visited", () => {
		expect(click({ nodeId: "cripta" })).toEqual({
			kind: "no-route",
			destinationName: translateNodeName(findNode(ACT_1, "cripta")!),
		});
	});

	it("names an unknown node by its id", () => {
		expect(click({ nodeId: "nowhere" })).toEqual({
			kind: "no-route",
			destinationName: "nowhere",
		});
	});
});
