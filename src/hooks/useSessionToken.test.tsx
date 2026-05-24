// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
	SessionTokenProvider,
	useSessionedMutation,
	useSessionToken,
} from "./useSessionToken";

describe("useSessionToken", () => {
	it("returns a stable UUID + a withSession helper that tacks it on", () => {
		const { result, rerender } = renderHook(() => useSessionToken(), {
			wrapper: ({ children }) => (
				<SessionTokenProvider>{children}</SessionTokenProvider>
			),
		});

		const firstToken = result.current.sessionToken;
		expect(firstToken).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
		);

		const wrapped = result.current.withSession({ characterId: "abc" });
		expect(wrapped).toEqual({
			characterId: "abc",
			sessionToken: firstToken,
		});

		rerender();
		expect(result.current.sessionToken).toBe(firstToken);
	});

	it("throws when used outside a SessionTokenProvider", () => {
		// renderHook surfaces render-phase throws by calling the hook directly;
		// suppress the React error log so the test output stays clean.
		const consoleError = console.error;
		console.error = () => {};
		try {
			expect(() => renderHook(() => useSessionToken())).toThrow(
				/missing SessionTokenProvider/,
			);
		} finally {
			console.error = consoleError;
		}
	});

	it("generates distinct tokens for distinct Provider mounts", () => {
		const { result: a } = renderHook(() => useSessionToken(), {
			wrapper: ({ children }) => (
				<SessionTokenProvider>{children}</SessionTokenProvider>
			),
		});
		const { result: b } = renderHook(() => useSessionToken(), {
			wrapper: ({ children }) => (
				<SessionTokenProvider>{children}</SessionTokenProvider>
			),
		});
		expect(a.current.sessionToken).not.toBe(b.current.sessionToken);
	});
});

describe("useSessionedMutation", () => {
	it("injects the per-tab sessionToken into the wrapped mutation's args", async () => {
		const mutation = vi.fn(
			async (_args: { x: number; sessionToken: string }) => "ok",
		);
		const { result } = renderHook(() => useSessionedMutation(mutation), {
			wrapper: ({ children }) => (
				<SessionTokenProvider>{children}</SessionTokenProvider>
			),
		});

		const callerArgs = { x: 42 };
		const out = await result.current(callerArgs);

		expect(out).toBe("ok");
		expect(mutation).toHaveBeenCalledTimes(1);
		const passed = mutation.mock.calls[0][0];
		expect(passed.x).toBe(42);
		expect(passed.sessionToken).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
		);
		// Caller's args object must not be mutated — the helper spreads to a fresh
		// object so the public signature stays session-free even if the caller
		// reuses the args reference.
		expect(callerArgs).toEqual({ x: 42 });
	});
});
