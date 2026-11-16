import { describe, expect, it } from "vitest";

import { ACT_1, findNode } from ".";
import { encounterPlanForNode } from "./encounter-schedule";
import { zoneContextFor } from "./zone-context";

describe("zoneContextFor", () => {
	it("reads a combat node's pool, level and plan", () => {
		const node = findNode(ACT_1, "forest_starter")!;
		expect(zoneContextFor(ACT_1, "forest_starter")).toEqual({
			node,
			monsterPool: node.monsterPool,
			level: node.level,
			encounterPlan: encounterPlanForNode(node),
			bossNode: null,
		});
	});

	it("carries a boss node's config", () => {
		const boss = ACT_1.nodes.find((n) => n.kind === "boss")!;
		expect(zoneContextFor(ACT_1, boss.id).bossNode).toBe(boss.bossNode);
	});

	it("has no pool or level in the city", () => {
		const ctx = zoneContextFor(ACT_1, "city");
		expect(ctx.monsterPool).toEqual([]);
		expect(ctx.level).toBeNull();
		expect(ctx.bossNode).toBeNull();
	});

	it("tolerates an unknown location", () => {
		const ctx = zoneContextFor(ACT_1, "nowhere");
		expect(ctx.node).toBeNull();
		expect(ctx.encounterPlan).toEqual(encounterPlanForNode(null));
	});
});
