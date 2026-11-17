// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetServerClock, setServerClockOffset } from "#/lib/server-clock";
import { m } from "#/paraglide/messages";

import TravelProgressBar from "./TravelProgressBar";

const START = 1_000_000;

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(START);
});

afterEach(() => {
	cleanup();
	resetServerClock();
	vi.useRealTimers();
});

const seconds = (n: number) =>
	screen.queryByText(m.travel_seconds_remaining({ seconds: n }));

function mount(arrivesAtMs: number, startedAtMs: number | null = START) {
	return render(
		<TravelProgressBar
			fromName="A"
			toName="B"
			startedAtMs={startedAtMs}
			arrivesAtMs={arrivesAtMs}
		/>,
	);
}

describe("TravelProgressBar", () => {
	it("counts the seconds down with the fill's duration", () => {
		const { container } = mount(START + 5000);
		expect(seconds(5)).toBeTruthy();
		const fill = container.querySelector<HTMLElement>(".bg-white");
		expect(fill?.style.animation).toContain("5000ms");
		act(() => {
			vi.advanceTimersByTime(4100);
		});
		expect(seconds(1)).toBeTruthy();
		act(() => {
			vi.advanceTimersByTime(1000);
		});
		expect(seconds(0)).toBeTruthy();
	});

	it("counts and fills over the trip's length when the server clock runs ahead", () => {
		const serverNow = START + 9000;
		const { container } = mount(serverNow + 3000, serverNow);
		expect(seconds(3)).toBeTruthy();
		const fill = container.querySelector<HTMLElement>(".bg-white");
		expect(fill?.style.animation).toContain("3000ms");
	});

	it("ticks under a second, so the counter turns with the fill", () => {
		mount(START + 2500);
		act(() => {
			vi.advanceTimersByTime(1600);
		});
		expect(seconds(1)).toBeTruthy();
	});

	it("resumes a trip already under way from its elapsed share", () => {
		const { container } = mount(START + 4000, START - 6000);
		expect(seconds(4)).toBeTruthy();
		const fill = container.querySelector<HTMLElement>(".bg-white");
		expect(fill?.style.animation).toContain("10000ms linear -6000ms");
	});

	it("reads the server's timestamps on the synced server clock", () => {
		act(() => setServerClockOffset(12_000));
		const serverNow = START + 12_000;
		const { container } = mount(serverNow + 2000, serverNow - 1000);
		expect(seconds(2)).toBeTruthy();
		const fill = container.querySelector<HTMLElement>(".bg-white");
		expect(fill?.style.animation).toContain("3000ms linear -1000ms");
	});

	it("re-anchors when the clock sync lands mid-trip", () => {
		const serverNow = START + 9000;
		mount(serverNow + 5000, serverNow - 2000);
		expect(seconds(7)).toBeTruthy();
		act(() => setServerClockOffset(9000));
		expect(seconds(5)).toBeTruthy();
	});
});
