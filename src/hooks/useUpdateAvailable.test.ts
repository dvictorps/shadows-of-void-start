// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Modules = {
	version: typeof import("#/lib/app-version");
	hook: typeof import("./useUpdateAvailable");
};

let mods: Modules;

beforeEach(async () => {
	vi.resetModules();
	mods = {
		version: await import("#/lib/app-version"),
		hook: await import("./useUpdateAvailable"),
	};
});

describe("useUpdateAvailable", () => {
	it("opens when the server reports another build", () => {
		const { result } = renderHook(() => mods.hook.useUpdateAvailable());
		expect(result.current.open).toBe(false);

		act(() => mods.version.noteServerBuild("a-newer-build"));

		expect(result.current.open).toBe(true);
	});

	it("stays closed after the player chooses later", () => {
		mods.version.noteServerBuild("a-newer-build");
		const { result } = renderHook(() => mods.hook.useUpdateAvailable());

		act(() => result.current.later());

		expect(result.current.open).toBe(false);
	});
});
