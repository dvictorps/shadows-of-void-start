// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useIncenseGuard } from "./useIncenseGuard";

function setup(incense: number) {
	const trigger = vi.fn<() => void>();
	const hook = renderHook(
		({ count }: { count: number }) => useIncenseGuard(count, trigger),
		{ initialProps: { count: incense } },
	);
	return { trigger, hook };
}

describe("useIncenseGuard", () => {
	it("lights once and blocks a second tap until the count moves", () => {
		const { trigger, hook } = setup(2);
		act(() => hook.result.current.lightIncense());
		expect(hook.result.current.isUsingIncense).toBe(true);
		act(() => hook.result.current.lightIncense());
		expect(trigger).toHaveBeenCalledTimes(1);
	});

	it("clears the flag when the optimistic count drops", () => {
		const { trigger, hook } = setup(2);
		act(() => hook.result.current.lightIncense());
		hook.rerender({ count: 1 });
		expect(hook.result.current.isUsingIncense).toBe(false);
		act(() => hook.result.current.lightIncense());
		expect(trigger).toHaveBeenCalledTimes(2);
	});

	it("clears the flag when a failed mutation reverts the count", () => {
		const { hook } = setup(2);
		act(() => hook.result.current.lightIncense());
		hook.rerender({ count: 1 });
		act(() => hook.result.current.lightIncense());
		hook.rerender({ count: 2 });
		expect(hook.result.current.isUsingIncense).toBe(false);
	});

	it("does nothing without incense", () => {
		const { trigger, hook } = setup(0);
		act(() => hook.result.current.lightIncense());
		expect(trigger).not.toHaveBeenCalled();
		expect(hook.result.current.isUsingIncense).toBe(false);
	});
});
