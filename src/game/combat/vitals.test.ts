import { describe, expect, it } from "vitest";
import { clampVital, resolveVitalSync } from "./vitals";

describe("clampVital", () => {
	it("floors fractional client values", () => {
		expect(clampVital(42.9, 100)).toBe(42);
	});

	it("clamps negatives up to 0", () => {
		expect(clampVital(-5, 100)).toBe(0);
	});

	it("clamps over-cap values down to max", () => {
		expect(clampVital(150, 100)).toBe(100);
	});

	it("passes an in-range integer through unchanged", () => {
		expect(clampVital(73, 100)).toBe(73);
	});
});

describe("resolveVitalSync", () => {
	const base = {
		maxLife: 100,
		maxBarrier: 50,
		prevHp: 80,
		prevBarrier: 50,
	};

	it("returns an empty patch when nothing changed (the idle-tick case)", () => {
		const r = resolveVitalSync({
			...base,
			clientHp: 80,
			clientBarrier: 50,
		});
		expect(r.hpCurrent).toBe(80);
		expect(r.patch).toEqual({});
	});

	it("patches only HP when barrier is unchanged", () => {
		const r = resolveVitalSync({
			...base,
			clientHp: 60,
			clientBarrier: 50,
		});
		expect(r.patch).toEqual({ hpCurrent: 60 });
	});

	it("patches only barrier when HP is unchanged", () => {
		const r = resolveVitalSync({
			...base,
			clientHp: 80,
			clientBarrier: 30,
		});
		expect(r.patch).toEqual({ barrierCurrent: 30 });
	});

	it("never writes barrier when the client omits it", () => {
		const r = resolveVitalSync({
			...base,
			clientHp: 60,
			clientBarrier: undefined,
		});
		expect(r.patch).toEqual({ hpCurrent: 60 });
		expect("barrierCurrent" in r.patch).toBe(false);
	});

	it("clamps both vitals before diffing (over-cap values don't persist)", () => {
		const r = resolveVitalSync({
			...base,
			clientHp: 999,
			clientBarrier: 999,
		});
		// 999 HP clamps to 100 (≠ prev 80) and 999 barrier clamps to 50 (== prev).
		expect(r.hpCurrent).toBe(100);
		expect(r.patch).toEqual({ hpCurrent: 100 });
	});

	it("floors a fractional HP before comparing", () => {
		const r = resolveVitalSync({
			...base,
			prevHp: 79,
			clientHp: 79.9,
			clientBarrier: undefined,
		});
		// 79.9 floors to 79, which equals prevHp — no write.
		expect(r.hpCurrent).toBe(79);
		expect(r.patch).toEqual({});
	});
});
