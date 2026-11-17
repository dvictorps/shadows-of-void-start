// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { type BarrierApi, useBarrier } from "./useBarrier";

type Props = { initialBarrier?: number };

describe("useBarrier — initialBarrier cold-start race", () => {
	it("syncs to initialBarrier when it transitions from undefined to a real value", () => {
		const { result, rerender } = renderHook<BarrierApi, Props>(
			({ initialBarrier }: Props) =>
				useBarrier({ maxBarrier: 100, initialBarrier, active: true }),
			{ initialProps: { initialBarrier: undefined } },
		);

		expect(result.current.barrier.current).toBe(100);

		act(() => {
			rerender({ initialBarrier: 30 });
		});

		expect(result.current.barrier.current).toBe(30);
		expect(result.current.barrierRef.current.current).toBe(30);
	});

	it("clamps initialBarrier to the current max on prop arrival", () => {
		const { result, rerender } = renderHook<BarrierApi, Props>(
			({ initialBarrier }: Props) =>
				useBarrier({ maxBarrier: 100, initialBarrier, active: true }),
			{ initialProps: { initialBarrier: undefined } },
		);

		act(() => {
			rerender({ initialBarrier: 500 });
		});

		expect(result.current.barrier.current).toBe(100);
	});

	it("bails when initialBarrier matches the existing current — no extra render", () => {
		let renderCount = 0;
		const { result, rerender } = renderHook<BarrierApi, Props>(
			({ initialBarrier }: Props) => {
				renderCount++;
				return useBarrier({ maxBarrier: 100, initialBarrier, active: true });
			},
			{ initialProps: { initialBarrier: 40 } },
		);

		expect(result.current.barrier.current).toBe(40);
		const after = renderCount;

		act(() => {
			rerender({ initialBarrier: 40 });
		});

		expect(result.current.barrier.current).toBe(40);
		expect(renderCount - after).toBeLessThanOrEqual(1);
	});
});
