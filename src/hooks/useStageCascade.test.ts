// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useStageCascade } from "./useStageCascade";

type Stage = "a" | "b" | "c";

const DURATIONS = { a: 300, b: 100, c: 100 } satisfies Record<Stage, number>;

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

function setup(active: boolean) {
	const onDone = vi.fn<() => void>();
	const hook = renderHook(
		({ on }) => {
			const [stage, setStage] = useState<Stage | null>("a");
			useStageCascade(on, stage, DURATIONS, setStage, onDone);
			return stage;
		},
		{ initialProps: { on: active } },
	);
	const advance = (ms: number) => {
		act(() => {
			vi.advanceTimersByTime(ms);
		});
	};
	return { ...hook, onDone, advance };
}

describe("useStageCascade", () => {
	it("walks the stages in table order, each for its own length, then calls onDone", () => {
		const t = setup(true);
		t.advance(299);
		expect(t.result.current).toBe("a");
		t.advance(1);
		expect(t.result.current).toBe("b");
		t.advance(100);
		expect(t.result.current).toBe("c");
		expect(t.onDone).not.toHaveBeenCalled();
		t.advance(100);
		expect(t.result.current).toBeNull();
		expect(t.onDone).toHaveBeenCalledTimes(1);
		t.advance(1000);
		expect(t.onDone).toHaveBeenCalledTimes(1);
	});

	it("holds while inactive and restarts the stage's timer when active again", () => {
		const t = setup(false);
		t.advance(1000);
		expect(t.result.current).toBe("a");
		t.rerender({ on: true });
		t.advance(200);
		t.rerender({ on: false });
		t.rerender({ on: true });
		t.advance(200);
		expect(t.result.current).toBe("a");
		t.advance(100);
		expect(t.result.current).toBe("b");
	});
});
