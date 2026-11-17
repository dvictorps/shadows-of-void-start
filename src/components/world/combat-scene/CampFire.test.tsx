// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CAMP_FIRE_FRAME_MS, CAMP_FIRE_FRAMES } from "./camp-fire";
import CampFire from "./CampFire";

function activeFrame(): string | null {
	const active = screen
		.getByTestId("camp-fire")
		.querySelector('img[data-active="true"]');
	return active?.getAttribute("src") ?? null;
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe("CampFire", () => {
	it("loads every frame and shows one at a time", () => {
		render(<CampFire />);
		const frames = screen.getByTestId("camp-fire").querySelectorAll("img");
		expect([...frames].map((f) => f.getAttribute("src"))).toEqual([
			...CAMP_FIRE_FRAMES,
		]);
		expect(
			screen
				.getByTestId("camp-fire")
				.querySelectorAll('img[data-active="true"]'),
		).toHaveLength(1);
	});

	it("moves to a different frame on every tick", () => {
		render(<CampFire />);
		let previous = activeFrame();
		for (let i = 0; i < 20; i++) {
			act(() => {
				vi.advanceTimersByTime(CAMP_FIRE_FRAME_MS);
			});
			const current = activeFrame();
			expect(current).not.toBe(previous);
			previous = current;
		}
	});
});
