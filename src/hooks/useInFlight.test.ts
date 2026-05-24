// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useInFlight } from "./useInFlight";

describe("useInFlight", () => {
	it("blocks re-entrant calls while a previous run is pending", async () => {
		const { result } = renderHook(() => useInFlight());

		let resolveFirst: (() => void) | null = null;
		const firstCallStarted = { value: false };
		const secondCallStarted = { value: false };

		let firstPromise: Promise<unknown> | undefined;
		await act(async () => {
			firstPromise = result.current[1](
				() =>
					new Promise<void>((resolve) => {
						firstCallStarted.value = true;
						resolveFirst = resolve;
					}),
			);
		});

		expect(firstCallStarted.value).toBe(true);
		expect(result.current[0]).toBe(true);

		let secondResult: unknown = "not-undefined";
		await act(async () => {
			secondResult = await result.current[1](async () => {
				secondCallStarted.value = true;
				return "second";
			});
		});

		expect(secondCallStarted.value).toBe(false);
		expect(secondResult).toBeUndefined();

		await act(async () => {
			resolveFirst?.();
			await firstPromise;
		});

		expect(result.current[0]).toBe(false);
	});

	it("clears the pending flag on a throw so the next click is unblocked", async () => {
		const { result } = renderHook(() => useInFlight());

		await act(async () => {
			await expect(
				result.current[1](async () => {
					throw new Error("boom");
				}),
			).rejects.toThrow("boom");
		});

		expect(result.current[0]).toBe(false);

		let secondRan = false;
		await act(async () => {
			await result.current[1](async () => {
				secondRan = true;
			});
		});

		expect(secondRan).toBe(true);
	});

	it("resets the pending flag when resetOn changes", async () => {
		let dep = "a";
		const { result, rerender } = renderHook(() => useInFlight(dep));

		let resolveLong: (() => void) | null = null;
		let longPromise: Promise<unknown> | undefined;
		await act(async () => {
			longPromise = result.current[1](
				() =>
					new Promise<void>((resolve) => {
						resolveLong = resolve;
					}),
			);
		});

		expect(result.current[0]).toBe(true);

		dep = "b";
		await act(async () => {
			rerender();
		});

		expect(result.current[0]).toBe(false);

		// The original promise still resolves — finally still fires, but the
		// state was already cleared by the reset effect. Acceptable because
		// the natural close boundary discards the result anyway.
		await act(async () => {
			resolveLong?.();
			await longPromise;
		});
		expect(result.current[0]).toBe(false);
	});
});
