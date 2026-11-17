// @vitest-environment jsdom

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
	campFractions: [],
	ambushes: {
		fractions: [0.25],
		packSize: { min: 2, max: 2 },
		gapWithinPackMs: 200,
		magicChance: 1,
	},
};

function setup(overrides: Partial<Props> = {}) {
	const onCampTriggered = vi.fn<Props["onCampTriggered"]>();
	const onEncounter = vi.fn<Props["onEncounter"]>();
	const onExitReached = vi.fn<Props["onExitReached"]>();
	const postMinibossPauseRef = { current: false };
	const initialProps: Props = {
		active: true,
		encounterPlan: PLAN,
		monsterPool: ["goblin"],
		serverBudgetMs: null,
		serverCampThresholdsMs: [5500],
		isSearching: true,
		postMinibossPauseRef,
		onCampTriggered,
		onEncounter,
		onExitReached,
		...overrides,
	};
	const hook = renderHook((props: Props) => useEncounterSchedule(props), {
		initialProps: { ...initialProps, active: false },
	});
	const enterZone = (next: Props = initialProps) => {
		act(() => hook.result.current.startVisit());
		hook.rerender({ ...next, active: true });
	};
	enterZone();
	return {
		...hook,
		initialProps,
		onCampTriggered,
		onEncounter,
		onExitReached,
		postMinibossPauseRef,
		enterZone,
	};
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

describe("useEncounterSchedule — walking the route", () => {
	it("advances only while active and searching", () => {
		const { result, rerender, initialProps } = setup();
		advance(500);
		expect(result.current.calmariaElapsedMs).toBe(500);

		rerender({ ...initialProps, isSearching: false });
		advance(1000);
		expect(result.current.calmariaElapsedMs).toBe(500);

		rerender({ ...initialProps, active: false });
		advance(1000);
		expect(result.current.calmariaElapsedMs).toBe(500);
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

	it("uses the server's rolled budget over the plan's", () => {
		const { result } = setup({ serverBudgetMs: 12_000 });
		expect(result.current.route.budgetMs).toBe(12_000);
		expect(result.current.route.stops.at(-1)).toEqual({
			kind: "exit",
			atMs: 12_000,
		});
	});

	it("meets each encounter at its stop, with the stop's monster", () => {
		const { result, onEncounter } = setup();
		advance(900);
		expect(onEncounter).not.toHaveBeenCalled();

		advance(TICK_MS);
		expect(onEncounter).toHaveBeenCalledExactlyOnceWith("goblin", "normal");
		expect(result.current.nextStopIndex).toBe(1);
		expect(result.current.calmariaElapsedMs).toBe(1000);
	});

	it("reaches the exit once every stop before it is behind", () => {
		const { onExitReached, onCampTriggered } = setup({
			serverCampThresholdsMs: [],
		});
		advance(10_000);
		expect(onExitReached).toHaveBeenCalledTimes(1);
		advance(2000);
		expect(onExitReached).toHaveBeenCalledTimes(1);
		expect(onCampTriggered).not.toHaveBeenCalled();
	});
});

describe("useEncounterSchedule — camps", () => {
	it("fires each server threshold once, with its index", () => {
		const { result, onCampTriggered } = setup({
			serverCampThresholdsMs: [3500, 6500],
		});
		advance(3400);
		expect(onCampTriggered).not.toHaveBeenCalled();

		advance(TICK_MS);
		expect(onCampTriggered).toHaveBeenCalledExactlyOnceWith(0);
		expect(result.current.campSource).toBe("baked");

		advance(3000);
		expect(onCampTriggered).toHaveBeenCalledTimes(2);
		expect(onCampTriggered).toHaveBeenLastCalledWith(1);
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
		advance(500);
		rerender({ ...initialProps, serverCampThresholdsMs: [1500] });
		advance(1000);
		expect(onCampTriggered).toHaveBeenCalledExactlyOnceWith(0);
	});

	it("an incense camp marks where it was lit and switches the source", () => {
		const { result } = setup();
		advance(700);
		act(() => result.current.startIncenseCamp());
		expect(result.current.campSource).toBe("incense");
		expect(result.current.incenseCampsMs).toEqual([700]);
	});
});

describe("useEncounterSchedule — ambushes", () => {
	it("rolls pack members with the ambush's magic chance and holds the pack open", () => {
		const { result, onEncounter } = setup({
			encounterPlan: AMBUSH_PLAN,
			serverCampThresholdsMs: [],
		});
		const pack = result.current.route.stops.filter(
			(s) => s.kind === "encounter" && s.pack === 0,
		);
		expect(pack).toHaveLength(2);

		advance(Math.ceil(pack[0].atMs / TICK_MS) * TICK_MS);
		expect(onEncounter).toHaveBeenLastCalledWith("goblin", "magic");
		expect(result.current.ambushActive).toBe(true);
		expect(result.current.isAmbushPackActive()).toBe(true);

		advance(200);
		expect(onEncounter).toHaveBeenLastCalledWith("goblin", "magic");
		expect(result.current.ambushActive).toBe(false);
	});
});

describe("useEncounterSchedule — visits", () => {
	it("a new visit resets the walk, the camps fired and the camp source", () => {
		const { result, rerender, initialProps, onCampTriggered, enterZone } =
			setup();
		advance(5500);
		expect(onCampTriggered).toHaveBeenCalledTimes(1);
		act(() => result.current.startIncenseCamp());

		rerender({ ...initialProps, active: false });
		enterZone();
		expect(result.current.calmariaElapsedMs).toBe(0);
		expect(result.current.nextStopIndex).toBe(0);
		expect(result.current.campSource).toBe("baked");
		expect(result.current.incenseCampsMs).toEqual([]);

		advance(5500);
		expect(onCampTriggered).toHaveBeenCalledTimes(2);
		expect(onCampTriggered).toHaveBeenLastCalledWith(0);
	});

	it("pausing and resuming the same visit keeps the walk", () => {
		const { result, rerender, initialProps } = setup();
		advance(2500);
		rerender({ ...initialProps, active: false });
		rerender({ ...initialProps, active: true });
		expect(result.current.calmariaElapsedMs).toBe(2500);
		expect(result.current.nextStopIndex).toBe(2);
	});

	it("resetForMiniboss rerolls the route from the entrance", () => {
		const { result } = setup();
		advance(3000);
		act(() => result.current.resetForMiniboss());
		expect(result.current.calmariaElapsedMs).toBe(0);
		expect(result.current.nextStopIndex).toBe(0);
	});
});
