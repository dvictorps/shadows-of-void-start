// @vitest-environment jsdom

import { act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	CLOCK_RESYNC_MS,
	resetServerClock,
	serverClockOffset,
} from "#/lib/server-clock";

import { renderWithServer } from "./trpc-hook-harness";
import { useServerClockSync } from "./useServerClockSync";

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
});
afterEach(() => {
	cleanup();
	resetServerClock();
	vi.useRealTimers();
});

async function settle() {
	await act(async () => {
		for (let i = 0; i < 20; i++) await Promise.resolve();
		await new Promise((done) => {
			setTimeout(done, 0);
		});
	});
}

describe("useServerClockSync", () => {
	it("moves the clock onto the server's on mount", async () => {
		const h = renderWithServer(() => useServerClockSync());
		h.server.reply("clock.now", { now: Date.now() + 60_000 });
		await settle();
		await settle();

		expect(Math.abs(serverClockOffset() - 60_000)).toBeLessThan(1000);
	});

	it("syncs again when the tab comes back into view after the resync interval", async () => {
		const h = renderWithServer(() => useServerClockSync());
		h.server.reply("clock.now", { now: Date.now() + 20_000 });
		await settle();
		await settle();
		expect(Math.abs(serverClockOffset() - 20_000)).toBeLessThan(1000);

		h.server.reply("clock.now", { now: Date.now() - 30_000 });
		document.dispatchEvent(new Event("visibilitychange"));
		await settle();
		expect(Math.abs(serverClockOffset() - 20_000)).toBeLessThan(1000);

		vi.setSystemTime(Date.now() + CLOCK_RESYNC_MS);
		h.server.reply("clock.now", { now: Date.now() - 30_000 });
		document.dispatchEvent(new Event("visibilitychange"));
		await settle();
		await settle();

		expect(Math.abs(serverClockOffset() + 30_000)).toBeLessThan(1000);
	});
});
