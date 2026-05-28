// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBarrier } from "./useBarrier";

describe("useBarrier — initialBarrier cold-start race", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("syncs to initialBarrier when it transitions from undefined to a real value", () => {
		// Reproduces the cold-start race: useBarrier mounts with
		// initialBarrier=undefined (combatState still loading), defaults
		// to full. Convex eventually serves the persisted value (e.g. 30
		// out of 100). Without the initialBarrier effect, useState would
		// drop the late-arriving value and the next syncHp would overwrite
		// the server with the local default of 100.
		const { result, rerender } = renderHook(
			({ initialBarrier }: { initialBarrier?: number }) =>
				useBarrier({ maxBarrier: 100, initialBarrier, active: true }),
			{ initialProps: { initialBarrier: undefined as number | undefined } },
		);

		expect(result.current.barrier.current).toBe(100);

		act(() => {
			rerender({ initialBarrier: 30 });
		});

		expect(result.current.barrier.current).toBe(30);
		expect(result.current.barrierRef.current.current).toBe(30);
	});

	it("clamps initialBarrier to the current max on prop arrival", () => {
		const { result, rerender } = renderHook(
			({ initialBarrier }: { initialBarrier?: number }) =>
				useBarrier({ maxBarrier: 100, initialBarrier, active: true }),
			{ initialProps: { initialBarrier: undefined as number | undefined } },
		);

		act(() => {
			rerender({ initialBarrier: 500 });
		});

		expect(result.current.barrier.current).toBe(100);
	});

	it("bails when initialBarrier matches the existing current — no extra render", () => {
		let renderCount = 0;
		const { result, rerender } = renderHook(
			({ initialBarrier }: { initialBarrier?: number }) => {
				renderCount++;
				return useBarrier({ maxBarrier: 100, initialBarrier, active: true });
			},
			{ initialProps: { initialBarrier: 40 as number | undefined } },
		);

		expect(result.current.barrier.current).toBe(40);
		const after = renderCount;

		act(() => {
			rerender({ initialBarrier: 40 });
		});

		expect(result.current.barrier.current).toBe(40);
		// One forced rerender from the test driver, no state-update-induced one.
		expect(renderCount - after).toBeLessThanOrEqual(1);
	});
});
