// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SessionTokenProvider, useSessionToken } from "./useSessionToken";

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
