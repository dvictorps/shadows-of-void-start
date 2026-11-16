// @vitest-environment jsdom

import { cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useEscapeLayer } from "./useEscapeLayer";

function layer(active = true) {
	const onEscape = vi.fn<() => void>();
	const hook = renderHook(
		({ on, handler }: { on: boolean; handler: () => void }) =>
			useEscapeLayer(on, handler),
		{ initialProps: { on: active, handler: onEscape } },
	);
	return { onEscape, ...hook };
}

const pressEscape = () => fireEvent.keyDown(document, { key: "Escape" });

afterEach(cleanup);

describe("useEscapeLayer", () => {
	it("routes Escape to the layer opened last only", () => {
		const below = layer();
		const top = layer();
		pressEscape();
		expect(top.onEscape).toHaveBeenCalledTimes(1);
		expect(below.onEscape).not.toHaveBeenCalled();
	});

	it("hands Escape back to the layer beneath once the top one closes", () => {
		const below = layer();
		const top = layer();
		top.unmount();
		pressEscape();
		expect(below.onEscape).toHaveBeenCalledTimes(1);
	});

	it("registers nothing while inactive, and drops out when deactivated", () => {
		const below = layer();
		const idle = layer(false);
		pressEscape();
		expect(below.onEscape).toHaveBeenCalledTimes(1);
		expect(idle.onEscape).not.toHaveBeenCalled();

		const top = layer();
		top.rerender({ on: false, handler: top.onEscape });
		pressEscape();
		expect(below.onEscape).toHaveBeenCalledTimes(2);
		expect(top.onEscape).not.toHaveBeenCalled();
	});

	it("keeps its place in the stack when the handler changes", () => {
		const below = layer();
		const top = layer();
		const next = vi.fn<() => void>();
		below.rerender({ on: true, handler: vi.fn<() => void>() });
		top.rerender({ on: true, handler: next });
		pressEscape();
		expect(next).toHaveBeenCalledTimes(1);
		expect(top.onEscape).not.toHaveBeenCalled();
	});

	it("ignores other keys", () => {
		const only = layer();
		fireEvent.keyDown(document, { key: "Enter" });
		expect(only.onEscape).not.toHaveBeenCalled();
	});

	it("stops listening once the stack is empty", () => {
		const added = vi.spyOn(window, "addEventListener");
		const removed = vi.spyOn(window, "removeEventListener");
		// Widened: the spy types `type` by a narrower overload than "keydown".
		const keydown: string = "keydown";
		const keydownCalls = (spy: typeof added) =>
			spy.mock.calls.filter(([type]) => type === keydown);
		const a = layer();
		const b = layer();
		expect(keydownCalls(added)).toHaveLength(1);
		a.unmount();
		expect(keydownCalls(removed)).toHaveLength(0);
		b.unmount();
		expect(keydownCalls(removed)).toHaveLength(1);
		added.mockRestore();
		removed.mockRestore();
	});
});
