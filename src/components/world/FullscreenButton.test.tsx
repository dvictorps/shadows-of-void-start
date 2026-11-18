// @vitest-environment jsdom

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { m } from "#/paraglide/messages";

import FullscreenButton from "./FullscreenButton";

function stubFullscreen(enabled: boolean) {
	let current: Element | null = null;
	const setCurrent = (el: Element | null) => {
		current = el;
		document.dispatchEvent(new Event("fullscreenchange"));
		return Promise.resolve();
	};
	Object.defineProperty(document, "fullscreenEnabled", {
		configurable: true,
		value: enabled,
	});
	Object.defineProperty(document, "fullscreenElement", {
		configurable: true,
		get: () => current,
	});
	const request = vi.fn<() => Promise<void>>(() =>
		setCurrent(document.documentElement),
	);
	const exit = vi.fn<() => Promise<void>>(() => setCurrent(null));
	document.documentElement.requestFullscreen = request;
	document.exitFullscreen = exit;
	return { request, exit };
}

afterEach(() => {
	cleanup();
});

describe("FullscreenButton", () => {
	it("enters full screen, then offers to leave it", async () => {
		const { request, exit } = stubFullscreen(true);
		render(<FullscreenButton />);
		await act(async () => {
			fireEvent.click(
				screen.getByRole("button", { name: m.enter_fullscreen() }),
			);
		});
		expect(request).toHaveBeenCalledOnce();
		const leave = screen.getByRole("button", { name: m.exit_fullscreen() });
		expect(leave.getAttribute("aria-pressed")).toBe("true");
		await act(async () => {
			fireEvent.click(leave);
		});
		expect(exit).toHaveBeenCalledOnce();
		expect(
			screen.getByRole("button", { name: m.enter_fullscreen() }),
		).toBeTruthy();
	});

	it("hides itself where the browser has no full screen", () => {
		stubFullscreen(false);
		render(<FullscreenButton />);
		expect(screen.queryByRole("button")).toBeNull();
	});
});
