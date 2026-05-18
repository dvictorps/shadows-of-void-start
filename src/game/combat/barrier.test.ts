import { describe, expect, it } from "vitest";
import {
	damageBarrier,
	makeBarrierState,
	rescaleBarrier,
	tickBarrierRecovery,
} from "./barrier";

describe("barrier state", () => {
	it("starts full with no recovery active", () => {
		const s = makeBarrierState(100);
		expect(s.current).toBe(100);
		expect(s.max).toBe(100);
		expect(s.recoveryRemaining).toBeNull();
	});

	it("damage to barrier reduces current, no overflow", () => {
		const s = makeBarrierState(100);
		const { state, lifeOverflow } = damageBarrier(s, 30);
		expect(state.current).toBe(70);
		expect(state.recoveryRemaining).toBeNull();
		expect(lifeOverflow).toBe(0);
	});

	it("damage that empties barrier triggers a 6s recovery timer", () => {
		const s = makeBarrierState(50);
		const { state, lifeOverflow } = damageBarrier(s, 80);
		expect(state.current).toBe(0);
		expect(state.recoveryRemaining).toBe(6);
		expect(lifeOverflow).toBe(30);
	});

	it("damage during recovery does NOT reset the timer", () => {
		let s = makeBarrierState(50);
		s = damageBarrier(s, 80).state; // empties → timer 6
		s = tickBarrierRecovery(s, 2); // timer 4
		// More damage: timer unchanged.
		const { state, lifeOverflow } = damageBarrier(s, 10);
		expect(state.current).toBe(0);
		expect(state.recoveryRemaining).toBe(4);
		expect(lifeOverflow).toBe(10);
	});

	it("timer expiry refills barrier to max in one step", () => {
		let s = makeBarrierState(50);
		s = damageBarrier(s, 80).state;
		s = tickBarrierRecovery(s, 6.5); // overshoots → refill
		expect(s.current).toBe(50);
		expect(s.recoveryRemaining).toBeNull();
	});

	it("rescaling to a smaller max clamps current and preserves timer", () => {
		let s = makeBarrierState(100);
		s = damageBarrier(s, 100).state; // empty → timer 6
		s = rescaleBarrier(s, 50);
		expect(s.max).toBe(50);
		expect(s.current).toBe(0);
		expect(s.recoveryRemaining).toBe(6);
	});

	it("rescaling to 0 zeroes the state entirely", () => {
		const s = rescaleBarrier(makeBarrierState(50), 0);
		expect(s.current).toBe(0);
		expect(s.max).toBe(0);
		expect(s.recoveryRemaining).toBeNull();
	});
});
