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

function mount(arrivesAtMs: number) {
	return render(
		<TravelProgressBar fromName="A" toName="B" arrivesAtMs={arrivesAtMs} />,
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

	it("keeps the counter on the mount's end time when arrivesAtMs moves later", () => {
		const view = mount(START + 5000);
		view.rerender(
			<TravelProgressBar fromName="A" toName="B" arrivesAtMs={START + 8000} />,
		);
		act(() => {
			vi.advanceTimersByTime(5000);
		});
		expect(seconds(0)).toBeTruthy();
	});

	it("ticks under a second, so the counter turns with the fill", () => {
		mount(START + 2500);
		act(() => {
			vi.advanceTimersByTime(1600);
		});
		expect(seconds(1)).toBeTruthy();
	});
});
