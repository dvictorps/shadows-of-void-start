import { describe, expect, it } from "vitest";
import {
	damageBarrier,
	makeBarrierState,
	rescaleBarrier,
	tickBarrier,
} from "./barrier";

describe("barrier state", () => {
	it("starts full with no cooldown", () => {
		const s = makeBarrierState(100);
		expect(s.current).toBe(100);
		expect(s.max).toBe(100);
		expect(s.cooldownRemaining).toBe(0);
	});

	it("damage to barrier reduces current, no overflow, no cooldown", () => {
		const s = makeBarrierState(100);
		const { state, lifeOverflow } = damageBarrier(s, 30);
		expect(state.current).toBe(70);
		expect(state.cooldownRemaining).toBe(0);
		expect(lifeOverflow).toBe(0);
	});

	it("damage that empties barrier triggers a 10s cooldown", () => {
		const s = makeBarrierState(50);
		const { state, lifeOverflow } = damageBarrier(s, 80);
		expect(state.current).toBe(0);
		expect(state.cooldownRemaining).toBe(10);
		expect(lifeOverflow).toBe(30);
	});

	it("damage during cooldown bleeds to life and does NOT reset the cooldown", () => {
		let s = makeBarrierState(50);
		s = damageBarrier(s, 80).state; // empties → cooldown 10
		s = tickBarrier(s, 2); // cooldown 8
		expect(s.cooldownRemaining).toBe(8);
		const { state, lifeOverflow } = damageBarrier(s, 10);
		expect(state.current).toBe(0);
		expect(state.cooldownRemaining).toBe(8); // unchanged
		expect(lifeOverflow).toBe(10); // damage bled straight to life
	});

	it("cooldown counts down via tickBarrier; regen stays paused until it elapses", () => {
		let s = makeBarrierState(100);
		s = damageBarrier(s, 100).state; // empties → cooldown 10
		s = tickBarrier(s, 5);
		expect(s.cooldownRemaining).toBe(5);
		expect(s.current).toBe(0); // still empty, no regen during cooldown
	});

	it("after cooldown elapses regen resumes at 5% of max per second from zero", () => {
		let s = makeBarrierState(100);
		s = damageBarrier(s, 100).state; // empties → cooldown 10
		s = tickBarrier(s, 10); // cooldown reaches 0
		expect(s.cooldownRemaining).toBe(0);
		expect(s.current).toBe(0);
		s = tickBarrier(s, 1); // one second of regen at 5%/s
		expect(s.current).toBeCloseTo(5);
		s = tickBarrier(s, 19); // 19 more seconds → 5 + 95 = 100, clamped
		expect(s.current).toBe(100);
	});

	it("regen ticks continuously while above zero (no delay, no interrupt)", () => {
		let s = makeBarrierState(100);
		s = damageBarrier(s, 30).state; // current 70, no cooldown
		expect(s.cooldownRemaining).toBe(0);
		s = tickBarrier(s, 1); // +5
		expect(s.current).toBeCloseTo(75);
		// More damage during regen — current drops, no cooldown change.
		s = damageBarrier(s, 20).state;
		expect(s.current).toBeCloseTo(55);
		expect(s.cooldownRemaining).toBe(0);
		// Regen keeps ticking.
		s = tickBarrier(s, 2);
		expect(s.current).toBeCloseTo(65);
	});

	it("tickBarrier is a no-op when barrier is already full and cooldown is zero", () => {
		const s = makeBarrierState(100);
		const next = tickBarrier(s, 1);
		expect(next).toBe(s);
	});

	it("rescaling to a smaller max clamps current and preserves cooldown", () => {
		let s = makeBarrierState(100);
		s = damageBarrier(s, 100).state; // empty → cooldown 10
		s = rescaleBarrier(s, 50);
		expect(s.max).toBe(50);
		expect(s.current).toBe(0);
		expect(s.cooldownRemaining).toBe(10);
	});

	it("rescaling to a larger max preserves current — no free refill", () => {
		let s = makeBarrierState(100);
		s = damageBarrier(s, 60).state; // current 40, no cooldown
		s = rescaleBarrier(s, 200);
		expect(s.max).toBe(200);
		expect(s.current).toBe(40);
		expect(s.cooldownRemaining).toBe(0);
	});

	it("rescaling to 0 zeroes the state entirely", () => {
		const s = rescaleBarrier(makeBarrierState(50), 0);
		expect(s.current).toBe(0);
		expect(s.max).toBe(0);
		expect(s.cooldownRemaining).toBe(0);
	});
});
