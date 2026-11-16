// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useExpiringList } from "./useExpiringList";

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("useExpiringList", () => {
	it("drops each entry after its lifetime", () => {
		const { result } = renderHook(() => useExpiringList<{ n: number }>(100));
		act(() => result.current.push({ n: 1 }));
		act(() => {
			vi.advanceTimersByTime(50);
		});
		act(() => result.current.push({ n: 2 }));
		expect(result.current.items.map((i) => i.n)).toEqual([1, 2]);
		act(() => {
			vi.advanceTimersByTime(50);
		});
		expect(result.current.items.map((i) => i.n)).toEqual([2]);
		act(() => {
			vi.advanceTimersByTime(50);
		});
		expect(result.current.items).toEqual([]);
	});

	it("gives every entry its own id", () => {
		const { result } = renderHook(() => useExpiringList<{ n: number }>(100));
		act(() => result.current.push({ n: 1 }));
		act(() => result.current.push({ n: 1 }));
		const [a, b] = result.current.items;
		expect(a.id).not.toBe(b.id);
	});

	it("clears on demand", () => {
		const { result } = renderHook(() => useExpiringList<{ n: number }>(100));
		act(() => result.current.push({ n: 1 }));
		act(() => result.current.clear());
		expect(result.current.items).toEqual([]);
	});

	it("leaves no timer behind on unmount", () => {
		const { result, unmount } = renderHook(() =>
			useExpiringList<{ n: number }>(100),
		);
		act(() => result.current.push({ n: 1 }));
		expect(vi.getTimerCount()).toBe(1);
		unmount();
		expect(vi.getTimerCount()).toBe(0);
	});
});
