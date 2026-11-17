// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ZoneEncounterPlan } from "#/game/world/encounter-schedule";
import type { ZoneRoute } from "#/game/world/zone-route";

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
		serverVisitId: null,
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
	let visits = 0;
	const enterZone = (next: Props = initialProps) => {
		act(() => hook.result.current.startVisit());
		visits += 1;
		initialProps.serverVisitId = `visit-${visits}`;
		hook.rerender({
			...next,
			serverVisitId: initialProps.serverVisitId,
			active: true,
		});
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

function routeOf(current: { route: ZoneRoute | null }): ZoneRoute {
	if (!current.route) throw new Error("route not ready");
	return current.route;
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
		expect(routeOf(result.current).budgetMs).toBe(12_000);
		expect(routeOf(result.current).stops.at(-1)).toEqual({
			kind: "exit",
			tile: 24,
			atMs: 11_750,
		});
	});

	it("meets each encounter as the walker enters its tile, with the stop's monster", () => {
		const { result, onEncounter } = setup();
		const [first] = routeOf(result.current).stops;
		expect(first).toMatchObject({ kind: "encounter", tile: 3, atMs: 1250 });
		advance(1200);
		expect(onEncounter).not.toHaveBeenCalled();

		advance(TICK_MS);
		expect(onEncounter).toHaveBeenCalledExactlyOnceWith("goblin", "normal");
		expect(result.current.nextStopIndex).toBe(1);
		expect(result.current.calmariaElapsedMs).toBe(1250);
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

describe("useEncounterSchedule — waiting for the server's visit", () => {
	it("draws and walks nothing until the new visit's budget arrives, so the path is rolled once", () => {
		const { result, rerender, initialProps, onEncounter } = setup();
		const entered = routeOf(result.current);

		act(() => result.current.startVisit());
		rerender({ ...initialProps, serverBudgetMs: 12_000 });
		expect(result.current.route).toBeNull();
		advance(3000);
		expect(result.current.calmariaElapsedMs).toBe(0);
		expect(onEncounter).not.toHaveBeenCalled();

		rerender({
			...initialProps,
			serverVisitId: "visit-next",
			serverBudgetMs: 12_000,
		});
		const route = routeOf(result.current);
		expect(route).not.toBe(entered);
		expect(route.budgetMs).toBe(12_000);
		advance(1300);
		expect(onEncounter).toHaveBeenCalledTimes(1);
	});
});

describe("useEncounterSchedule — camps", () => {
	it("fires each server threshold once, with its index", () => {
		const { result, onCampTriggered } = setup({
			serverCampThresholdsMs: [3500, 6500],
		});
		advance(3550);
		expect(onCampTriggered).not.toHaveBeenCalled();

		advance(700);
		expect(onCampTriggered).toHaveBeenCalledExactlyOnceWith(0);
		expect(result.current.campSource).toBe("baked");

		advance(3500);
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
		advance(1500);
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
		const pack = routeOf(result.current).stops.filter(
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
		advance(6500);
		expect(onCampTriggered).toHaveBeenCalledTimes(1);
		act(() => result.current.startIncenseCamp());

		rerender({ ...initialProps, active: false });
		enterZone();
		expect(result.current.calmariaElapsedMs).toBe(0);
		expect(result.current.nextStopIndex).toBe(0);
		expect(result.current.campSource).toBe("baked");
		expect(result.current.incenseCampsMs).toEqual([]);

		advance(6500);
		expect(onCampTriggered).toHaveBeenCalledTimes(2);
		expect(onCampTriggered).toHaveBeenLastCalledWith(0);
	});

	it("pausing and resuming the same visit keeps the walk", () => {
		const { result, rerender, initialProps } = setup();
		advance(2500);
		const walked = result.current.calmariaElapsedMs;
		expect(result.current.nextStopIndex).toBe(2);
		rerender({ ...initialProps, active: false });
		rerender({ ...initialProps, active: true });
		expect(result.current.calmariaElapsedMs).toBe(walked);
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
