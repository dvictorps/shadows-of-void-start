// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ruleError } from "#/components/trpc-test-utils";
import { CHARACTER_ID } from "#/components/world/item-test-fixtures";
import { SERVER_ERRORS } from "#/lib/server-errors";
import { ARRIVAL_RETRY_MS } from "#/lib/travel-clock";

import { useViewMode } from "./useViewMode";
import type { useWorldMutations } from "./useWorldMutations";

type WorldMutations = ReturnType<typeof useWorldMutations>;
type Props = Parameters<typeof useViewMode>[0];

const NOW = 1_000_000;
const TRIP_MS = 4000;

function makeServer() {
	return {
		enterCity: vi
			.fn<WorldMutations["enterCity"]>()
			.mockResolvedValue({ hpCurrent: 100, potions: 3 }),
		enterZone: vi.fn<WorldMutations["enterZone"]>().mockResolvedValue({
			zoneSession: "00000000-0000-4000-8000-000000000001",
			zoneStartedAt: NOW,
			campThresholdsMs: [],
		}),
		arriveAtTravel: vi.fn<WorldMutations["arriveAtTravel"]>(),
	};
}

function setup(overrides: Partial<Props> = {}, arrivedAt = "forest_starter") {
	const server = makeServer();
	const onEnterNewArea = vi.fn<(nodeId: string) => void>();
	const props: Props = {
		characterId: CHARACTER_ID,
		travelDestination: null,
		travelStartedAt: null,
		travelArrivesAt: null,
		...server,
		onEnterNewArea,
		...overrides,
	};
	const landed: Props = {
		...props,
		travelDestination: null,
		travelStartedAt: null,
		travelArrivesAt: null,
	};
	server.arriveAtTravel.mockImplementation(() =>
		Promise.resolve().then(() => {
			hook.rerender(landed);
			return { arrivedAt };
		}),
	);
	const hook = renderHook((p: Props) => useViewMode(p), {
		initialProps: props,
	});
	return { ...hook, props, server, onEnterNewArea };
}

async function advance(ms: number) {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(ms);
	});
}

const TRAVELING = {
	travelDestination: "forest_starter",
	travelStartedAt: NOW,
	travelArrivesAt: NOW + TRIP_MS,
};

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(NOW);
});

afterEach(() => {
	vi.useRealTimers();
});

describe("useViewMode", () => {
	it("starts on the map and calls nothing while idle", async () => {
		const h = setup();

		await advance(60_000);

		expect(h.result.current.view).toBe("map");
		expect(h.result.current.isTraveling).toBe(false);
		expect(h.result.current.pendingArrival).toBeNull();
		expect(h.server.arriveAtTravel).not.toHaveBeenCalled();
	});

	it("arrives when the trip ends and enters the zone", async () => {
		const h = setup(TRAVELING);
		expect(h.result.current.isTraveling).toBe(true);
		expect(h.result.current.pendingArrival).toBe("forest_starter");

		await advance(TRIP_MS - 1);
		expect(h.server.arriveAtTravel).not.toHaveBeenCalled();

		await advance(1);
		expect(h.server.arriveAtTravel).toHaveBeenCalledExactlyOnceWith({
			characterId: CHARACTER_ID,
		});
		expect(h.result.current.pendingArrival).toBeNull();
		expect(h.result.current.view).toBe("combat");
		expect(h.onEnterNewArea).toHaveBeenCalledWith("forest_starter");
		expect(h.server.enterZone).toHaveBeenCalledExactlyOnceWith({
			characterId: CHARACTER_ID,
			zoneId: "forest_starter",
		});
		expect(h.server.enterCity).not.toHaveBeenCalled();
	});

	it("arrives at once after a refresh whose trip already ended", async () => {
		const h = setup(
			{
				travelDestination: "city",
				travelStartedAt: NOW - 3010,
				travelArrivesAt: NOW - 10,
			},
			"city",
		);

		await advance(0);
		expect(h.server.arriveAtTravel).toHaveBeenCalledOnce();
		expect(h.result.current.view).toBe("city");
		expect(h.server.enterCity).toHaveBeenCalledExactlyOnceWith({
			characterId: CHARACTER_ID,
		});
	});

	it("does not enter anything when the server lands somewhere else", async () => {
		const h = setup(TRAVELING, "city");

		await advance(TRIP_MS);

		expect(h.server.arriveAtTravel).toHaveBeenCalledOnce();
		expect(h.result.current.view).toBe("map");
		expect(h.server.enterCity).not.toHaveBeenCalled();
		expect(h.server.enterZone).not.toHaveBeenCalled();
	});

	it("gives up on an arrival refused for another reason", async () => {
		const h = setup(TRAVELING);
		h.server.arriveAtTravel.mockRejectedValue(new Error("network down"));

		await advance(TRIP_MS + ARRIVAL_RETRY_MS * 3);

		expect(h.server.arriveAtTravel).toHaveBeenCalledOnce();
		expect(h.result.current.view).toBe("map");
		expect(h.server.enterZone).not.toHaveBeenCalled();
	});

	it("retries while the server says the trip is not over yet", async () => {
		const h = setup(TRAVELING);
		h.server.arriveAtTravel
			.mockRejectedValueOnce(ruleError(SERVER_ERRORS.travelNotComplete))
			.mockRejectedValueOnce(ruleError(SERVER_ERRORS.travelNotComplete));

		await advance(TRIP_MS);
		expect(h.server.arriveAtTravel).toHaveBeenCalledOnce();

		await advance(ARRIVAL_RETRY_MS);
		expect(h.server.arriveAtTravel).toHaveBeenCalledTimes(2);

		await advance(ARRIVAL_RETRY_MS);
		expect(h.server.arriveAtTravel).toHaveBeenCalledTimes(3);
		expect(h.result.current.view).toBe("combat");
	});

	it("stops retrying once unmounted", async () => {
		const h = setup(TRAVELING);
		h.server.arriveAtTravel.mockRejectedValue(
			ruleError(SERVER_ERRORS.travelNotComplete),
		);

		await advance(TRIP_MS);
		h.unmount();
		await advance(ARRIVAL_RETRY_MS * 3);

		expect(h.server.arriveAtTravel).toHaveBeenCalledOnce();
	});

	it("keeps the first end time when the server's timestamps arrive on a skewed clock", async () => {
		const h = setup(TRAVELING);
		const serverNow = NOW + 9000;

		h.rerender({
			...h.props,
			travelStartedAt: serverNow,
			travelArrivesAt: serverNow + TRIP_MS,
		});

		await advance(TRIP_MS);
		expect(h.server.arriveAtTravel).toHaveBeenCalledOnce();
		expect(h.result.current.view).toBe("combat");
	});

	it("waits no longer than the trip when the first sight is a server time from a clock ahead", async () => {
		const serverNow = NOW + 9000;
		const h = setup({
			travelDestination: "forest_starter",
			travelStartedAt: serverNow,
			travelArrivesAt: serverNow + TRIP_MS,
		});

		await advance(TRIP_MS);
		expect(h.server.arriveAtTravel).toHaveBeenCalledOnce();
	});

	it("cancels the timer on unmount", async () => {
		const h = setup(TRAVELING);

		h.unmount();
		await advance(TRIP_MS);

		expect(h.server.arriveAtTravel).not.toHaveBeenCalled();
	});

	it("enterDestination switches the view and enters the node without a trip", () => {
		const h = setup();

		act(() => h.result.current.enterDestination("city"));
		expect(h.result.current.view).toBe("city");
		expect(h.server.enterCity).toHaveBeenCalledOnce();

		act(() => h.result.current.enterDestination("no-such-node"));
		expect(h.result.current.view).toBe("city");
		expect(h.onEnterNewArea).toHaveBeenCalledTimes(1);
	});
});
