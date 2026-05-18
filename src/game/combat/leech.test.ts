import { describe, expect, it } from "vitest";
import { createLeechInstance, tickLeechInstances } from "./leech";

describe("leech", () => {
	it("createLeechInstance returns null for 0% leech", () => {
		expect(createLeechInstance(100, 0)).toBeNull();
	});

	it("createLeechInstance returns null for 0 damage", () => {
		expect(createLeechInstance(0, 5)).toBeNull();
	});

	it("creates an instance with magnitude × 0.20 per second rate", () => {
		const inst = createLeechInstance(200, 5);
		expect(inst).not.toBeNull();
		if (!inst) return;
		expect(inst.magnitude).toBeCloseTo(10);
		expect(inst.rate).toBeCloseTo(2);
		expect(inst.remaining).toBeCloseTo(10);
	});

	it("ticks deliver rate × dt per instance", () => {
		const inst = createLeechInstance(200, 5);
		if (!inst) throw new Error("expected instance");
		const { healed, instances } = tickLeechInstances([inst], 0.5, 1000);
		// rate = 2, dt = 0.5 → 1.0 healed; remaining = 9.
		expect(healed).toBeCloseTo(1);
		expect(instances).toHaveLength(1);
		expect(instances[0].remaining).toBeCloseTo(9);
	});

	it("instance burns down to zero and is dropped", () => {
		const inst = createLeechInstance(200, 5);
		if (!inst) throw new Error("expected instance");
		const { instances } = tickLeechInstances([inst], 10, 1000);
		expect(instances).toHaveLength(0);
	});

	it("caps total heal per tick at 20% maxLife per second", () => {
		// Many instances, each rate 100/s. dt = 0.1s. Want = 100×0.1 × 5 = 50.
		// Cap = 1000 × 0.20 × 0.1 = 20. So healed clamps to 20.
		const instances = Array.from({ length: 5 }, () => ({
			magnitude: 100,
			rate: 100,
			remaining: 100,
		}));
		const { healed } = tickLeechInstances(instances, 0.1, 1000);
		expect(healed).toBeCloseTo(20);
	});
});
