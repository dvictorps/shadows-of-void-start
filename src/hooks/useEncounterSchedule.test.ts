// @vitest-environment jsdom

// The encounter schedule drives the zone's pacing: the calmaria time bar, the
// camp and ambush triggers, and the rarity of the next spawn. These tests run
// the real hook on fake timers. `Math.random` is pinned to 0.5 so the rolled
// jitter is zero (`randSymmetric`) and the rolled sizes are deterministic.

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ZoneEncounterPlan } from "#/game/world/encounter-schedule";

import { useEncounterSchedule } from "./useEncounterSchedule";

type Props = Parameters<typeof useEncounterSchedule>[0];

const TICK_MS = 100;

const PLAN: ZoneEncounterPlan = {
	calmariaBudgetSeconds: 10,
	gapBetweenSpawns: { min: 1, max: 1 },
	campFractions: [0.5],
};

const AMBUSH_PLAN: ZoneEncounterPlan = {
	...PLAN,
	// No camps, so only the ambush fires along the bar.
	campFractions: [],
	ambushes: {
		fractions: [0.3],
		packSize: { min: 2, max: 2 },
		gapWithinPackMs: 200,
		magicChance: 1,
	},
};

function setup(overrides: Partial<Props> = {}) {
	const onCampTriggered = vi.fn<Props["onCampTriggered"]>();
	const postMinibossPauseRef = { current: false };
	const initialProps: Props = {
		active: true,
		encounterPlan: PLAN,
		serverCampThresholdsMs: [5000],
		isSearching: true,
		postMinibossPauseRef,
		onCampTriggered,
		...overrides,
	};
	// Mounted inactive, then activated, as in the app: `/world` opens on the
	// map and the combat view flips `active` on zone entry. The activation
	// effect (false → true) is what rolls the visit's ambush schedule.
	const hook = renderHook((props: Props) => useEncounterSchedule(props), {
		initialProps: { ...initialProps, active: false },
	});
	hook.rerender(initialProps);
	return { ...hook, initialProps, onCampTriggered, postMinibossPauseRef };
}

function advance(ms: number) {
	act(() => {
		vi.advanceTimersByTime(ms);
	});
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.spyOn(Math, "random").mockReturnValue(0.5);
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("useEncounterSchedule — calmaria time bar", () => {
	it("fills only while active and searching", () => {
		const { result, rerender, initialProps } = setup();
		advance(1000);
		expect(result.current.calmariaElapsedMs).toBe(1000);

		rerender({ ...initialProps, isSearching: false });
		advance(1000);
		expect(result.current.calmariaElapsedMs).toBe(1000);

		rerender({ ...initialProps, active: false });
		advance(1000);
		expect(result.current.calmariaElapsedMs).toBe(1000);
	});

	it("holds while the post-miniboss pause flag is set", () => {
		const { result, postMinibossPauseRef } = setup();
		advance(500);
		postMinibossPauseRef.current = true;
		advance(1000);
		expect(result.current.calmariaElapsedMs).toBe(500);

		postMinibossPauseRef.current = false;
		advance(TICK_MS);
		expect(result.current.calmariaElapsedMs).toBe(600);
	});

	it("resets the bar, the camp index and the camp source on re-activation", () => {
		const { result, rerender, initialProps, onCampTriggered } = setup();
		advance(5000);
		expect(onCampTriggered).toHaveBeenCalledTimes(1);
		act(() => result.current.setCampSource("incense"));

		rerender({ ...initialProps, active: false });
		rerender({ ...initialProps, active: true });
		expect(result.current.calmariaElapsedMs).toBe(0);
		expect(result.current.campSource).toBe("baked");

		// The camp index rewound too: the same threshold fires again.
		advance(5000);
		expect(onCampTriggered).toHaveBeenCalledTimes(2);
		expect(onCampTriggered).toHaveBeenLastCalledWith(0);
	});
});

describe("useEncounterSchedule — camps", () => {
	it("fires each server threshold once, with its index", () => {
		const { result, onCampTriggered } = setup({
			serverCampThresholdsMs: [3000, 6000],
		});
		advance(2900);
		expect(onCampTriggered).not.toHaveBeenCalled();

		advance(TICK_MS);
		expect(onCampTriggered).toHaveBeenCalledExactlyOnceWith(0);
		expect(result.current.campSource).toBe("baked");

		advance(3000);
		expect(onCampTriggered).toHaveBeenCalledTimes(2);
		expect(onCampTriggered).toHaveBeenLastCalledWith(1);

		advance(3000);
		expect(onCampTriggered).toHaveBeenCalledTimes(2);
	});

	it("never fires a camp at or past the budget: the miniboss wins there", () => {
		const { onCampTriggered } = setup({ serverCampThresholdsMs: [10_000] });
		advance(12_000);
		expect(onCampTriggered).not.toHaveBeenCalled();
	});

	it("picks up thresholds the server writes after activation", () => {
		const { rerender, initialProps, onCampTriggered } = setup({
			serverCampThresholdsMs: [],
		});
		advance(1000);
		rerender({ ...initialProps, serverCampThresholdsMs: [2000] });
		advance(1000);
		expect(onCampTriggered).toHaveBeenCalledExactlyOnceWith(0);
	});
});

describe("useEncounterSchedule — spawn rarity and ambushes", () => {
	it("rolls a rare (the miniboss) once the bar is full", () => {
		const { result } = setup({ serverCampThresholdsMs: [] });
		expect(result.current.rollSpawnRarity()).toBe("normal");
		advance(10_000);
		expect(result.current.rollSpawnRarity()).toBe("rare");
	});

	it("opens an ambush pack at its threshold: short gap, boosted magic, drained per spawn", () => {
		const { result } = setup({
			encounterPlan: AMBUSH_PLAN,
			serverCampThresholdsMs: [],
		});
		expect(result.current.nextSpawnGapMs).toBe(1000);
		advance(2900);
		expect(result.current.ambushActive).toBe(false);

		advance(TICK_MS);
		expect(result.current.ambushActive).toBe(true);
		expect(result.current.isAmbushPackActive()).toBe(true);
		expect(result.current.nextSpawnGapMs).toBe(200);
		expect(result.current.rollSpawnRarity()).toBe("magic");

		act(() => result.current.consumeAmbushSlot());
		expect(result.current.ambushActive).toBe(true);
		act(() => result.current.consumeAmbushSlot());
		expect(result.current.ambushActive).toBe(false);
		expect(result.current.isAmbushPackActive()).toBe(false);
		expect(result.current.rollSpawnRarity()).toBe("normal");
	});

	it("keeps the in-pack gap across spawns and drops it once the pack drains", () => {
		const { result, rerender, initialProps } = setup({
			encounterPlan: AMBUSH_PLAN,
			serverCampThresholdsMs: [],
		});
		advance(3000);
		act(() => result.current.consumeAmbushSlot());
		// Back to searching mid-pack: the gap stays short.
		rerender({ ...initialProps, isSearching: false });
		rerender({ ...initialProps, isSearching: true });
		expect(result.current.nextSpawnGapMs).toBe(200);

		act(() => result.current.consumeAmbushSlot());
		rerender({ ...initialProps, isSearching: false });
		rerender({ ...initialProps, isSearching: true });
		expect(result.current.nextSpawnGapMs).toBe(1000);
	});

	it("cancelAmbush drains the pack at once (incense)", () => {
		const { result } = setup({
			encounterPlan: AMBUSH_PLAN,
			serverCampThresholdsMs: [],
		});
		advance(3000);
		act(() => result.current.cancelAmbush());
		expect(result.current.ambushActive).toBe(false);
		expect(result.current.isAmbushPackActive()).toBe(false);
	});

	it("resetForMiniboss zeroes the bar and re-arms the ambushes", () => {
		const { result } = setup({
			encounterPlan: AMBUSH_PLAN,
			serverCampThresholdsMs: [],
		});
		advance(3000);
		act(() => result.current.resetForMiniboss());
		expect(result.current.calmariaElapsedMs).toBe(0);
		expect(result.current.ambushActive).toBe(false);

		advance(3000);
		expect(result.current.ambushActive).toBe(true);
	});
});
