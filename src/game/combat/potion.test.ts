import { describe, expect, it } from "vitest";
import { POTION_HEAL_FRACTION } from "./constants";
import { resolvePotionUse } from "./potion";

describe("resolvePotionUse", () => {
	it("refuses when the player has no potions", () => {
		const r = resolvePotionUse({
			potions: 0,
			maxLife: 100,
			prevHp: 10,
			clientHp: undefined,
		});
		expect(r).toEqual({ ok: false, reason: "no-potions" });
	});

	it("refuses when already at full HP", () => {
		const r = resolvePotionUse({
			potions: 3,
			maxLife: 100,
			prevHp: 100,
			clientHp: undefined,
		});
		expect(r).toEqual({ ok: false, reason: "already-full" });
	});

	it("heals the configured fraction of max life and spends one potion", () => {
		const r = resolvePotionUse({
			potions: 3,
			maxLife: 100,
			prevHp: 40,
			clientHp: undefined,
		});
		// 40 + floor(100 * 0.2) = 60
		expect(r).toEqual({
			ok: true,
			hpCurrent: 40 + Math.floor(100 * POTION_HEAL_FRACTION),
			potions: 2,
		});
	});

	it("never heals above max life", () => {
		const r = resolvePotionUse({
			potions: 1,
			maxLife: 100,
			prevHp: 95,
			clientHp: undefined,
		});
		expect(r).toEqual({ ok: true, hpCurrent: 100, potions: 0 });
	});

	it("prefers the live clientHp over the stored prevHp", () => {
		// Stored HP is stale (80) but the live combat loop reports 30 — the potion
		// must heal from 30, not 80.
		const r = resolvePotionUse({
			potions: 2,
			maxLife: 100,
			prevHp: 80,
			clientHp: 30,
		});
		expect(r).toEqual({ ok: true, hpCurrent: 50, potions: 1 });
	});

	it("clamps a tampered over-cap clientHp before healing", () => {
		// A clientHp above maxLife clamps to maxLife → already-full refusal, so it
		// can't be used to over-heal.
		const r = resolvePotionUse({
			potions: 2,
			maxLife: 100,
			prevHp: 50,
			clientHp: 999,
		});
		expect(r).toEqual({ ok: false, reason: "already-full" });
	});

	it("floors a fractional clientHp before healing", () => {
		const r = resolvePotionUse({
			potions: 2,
			maxLife: 100,
			prevHp: 50,
			clientHp: 40.9,
		});
		// floor(40.9) = 40 → 40 + 20 = 60
		expect(r).toEqual({ ok: true, hpCurrent: 60, potions: 1 });
	});
});
