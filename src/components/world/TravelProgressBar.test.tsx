// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { m } from "#/paraglide/messages";

import TravelProgressBar from "./TravelProgressBar";

const START = 1_000_000;

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(START);
});

afterEach(() => {
	cleanup();
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
});
