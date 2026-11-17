import { describe, expect, it } from "vitest";

import {
	damageBarrier,
	makeBarrierState,
	rescaleBarrier,
	tickBarrier,
} from "./barrier";

describe("barrier state", () => {
	it("starts full with no refill cycle pending", () => {
		const s = makeBarrierState(100);
		expect(s.current).toBe(100);
		expect(s.max).toBe(100);
		expect(s.refillRemaining).toBe(0);
	});

	it("damage absorbed 1:1; sub-break leaves no refill timer", () => {
		const s = makeBarrierState(100);
		const { state, lifeOverflow } = damageBarrier(s, 30);
		expect(state.current).toBe(70);
		expect(state.refillRemaining).toBe(0);
		expect(lifeOverflow).toBe(0);
	});

	it("damage that empties barrier triggers a 10s refill timer; remainder carries to life", () => {
		const s = makeBarrierState(60);
		const { state, lifeOverflow } = damageBarrier(s, 100);
		expect(state.current).toBe(0);
		expect(state.refillRemaining).toBe(10);
		expect(lifeOverflow).toBe(40);
	});

	it("damage during refill cooldown bleeds entirely to life; does NOT reset the timer", () => {
		let s = makeBarrierState(50);
		s = damageBarrier(s, 100).state;
		s = tickBarrier(s, 2);
		expect(s.refillRemaining).toBe(8);
		const { state, lifeOverflow } = damageBarrier(s, 10);
		expect(state.current).toBe(0);
		expect(state.refillRemaining).toBe(8);
		expect(lifeOverflow).toBe(10);
	});

	it("refill timer counts down via tickBarrier; current stays at zero until the snap", () => {
		let s = makeBarrierState(100);
		s = damageBarrier(s, 200).state;
		s = tickBarrier(s, 5);
		expect(s.refillRemaining).toBe(5);
		expect(s.current).toBe(0);
		s = tickBarrier(s, 4);
		expect(s.refillRemaining).toBe(1);
		expect(s.current).toBe(0);
	});

	it("when refill timer reaches zero, current snaps instantly to max", () => {
		let s = makeBarrierState(100);
		s = damageBarrier(s, 200).state;
		s = tickBarrier(s, 10);
		expect(s.refillRemaining).toBe(0);
		expect(s.current).toBe(100);
	});

	it("partial barrier with no active refill stays put — no passive regen", () => {
		let s = makeBarrierState(100);
		s = damageBarrier(s, 30).state;
		expect(s.refillRemaining).toBe(0);
		s = tickBarrier(s, 100);
		expect(s.current).toBe(70);
		expect(s.refillRemaining).toBe(0);
	});

	it("tickBarrier is a no-op when full and no refill pending", () => {
		const s = makeBarrierState(100);
		const next = tickBarrier(s, 1);
		expect(next).toBe(s);
	});

	it("monster barrier follows the same rules (symmetric)", () => {
		const monster = makeBarrierState(120);
		const { state, lifeOverflow } = damageBarrier(monster, 200);
		expect(state.current).toBe(0);
		expect(state.refillRemaining).toBe(10);
		expect(lifeOverflow).toBe(80);
	});

	it("rescaling to a smaller max clamps current and preserves refill timer", () => {
		let s = makeBarrierState(100);
		s = damageBarrier(s, 200).state;
		s = rescaleBarrier(s, 50);
		expect(s.max).toBe(50);
		expect(s.current).toBe(0);
		expect(s.refillRemaining).toBe(10);
	});

	it("rescaling to a larger max preserves current — no free refill", () => {
		let s = makeBarrierState(100);
		s = damageBarrier(s, 40).state;
		s = rescaleBarrier(s, 200);
		expect(s.max).toBe(200);
		expect(s.current).toBe(60);
		expect(s.refillRemaining).toBe(0);
	});

	it("rescaling to 0 clears current and max but preserves the refill timer", () => {
		let s = makeBarrierState(100);
		s = damageBarrier(s, 200).state;
		s = rescaleBarrier(s, 0);
		expect(s.current).toBe(0);
		expect(s.max).toBe(0);
		expect(s.refillRemaining).toBe(10);
	});

	it("refill timer ticks down even while max is zero (no gear-swap exploit)", () => {
		let s = makeBarrierState(100);
		s = damageBarrier(s, 200).state;
		s = rescaleBarrier(s, 0);
		s = tickBarrier(s, 10);
		expect(s.refillRemaining).toBe(0);
		s = rescaleBarrier(s, 100);
		expect(s.max).toBe(100);
		expect(s.current).toBe(100);
	});

	it("seedAtFull triggers when re-equipping after unequip-from-partial (acknowledged minor refill on full gear-cycle)", () => {
		let s = makeBarrierState(100);
		s = damageBarrier(s, 30).state;
		s = rescaleBarrier(s, 0);
		s = rescaleBarrier(s, 100);
		expect(s.current).toBe(100);
	});
});
