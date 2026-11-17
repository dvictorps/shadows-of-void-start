// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CombatPhase } from "#/game/combat/constants";

import { type ExitFlowServer, useExitFlow } from "./useExitFlow";
import { useModal } from "./useModal";

const CHARACTER_ID = 7;

type Props = {
	bagSize: number | undefined;
	phase: CombatPhase;
	teleportStones: number;
};

function setup(initial: Partial<Props> = {}) {
	const server = {
		exitZone: vi.fn<ExitFlowServer["exitZone"]>(async () => ({})),
		pickFromBag: vi.fn<ExitFlowServer["pickFromBag"]>(async () => ({})),
		discardFromBag: vi.fn<ExitFlowServer["discardFromBag"]>(async () => ({})),
		teleportStone: vi.fn<ExitFlowServer["teleportStone"]>(async () => ({})),
	};
	const backToMap = vi.fn<() => void>();
	const setPendingArrival = vi.fn<(nodeId: string | null) => void>();
	const hook = renderHook(
		(props: Props) => {
			const exitModal = useModal();
			const flow = useExitFlow({
				characterId: CHARACTER_ID,
				view: "combat",
				exitModal,
				server,
				backToMap,
				setPendingArrival,
				...props,
			});
			return { exitModal, flow };
		},
		{
			initialProps: {
				bagSize: 0,
				phase: "exploration",
				teleportStones: 1,
				...initial,
			},
		},
	);
	const flow = () => hook.result.current.flow;
	const modalOpen = () => hook.result.current.exitModal.isOpen;
	return { server, backToMap, setPendingArrival, hook, flow, modalOpen };
}

const stoneToCityArgs = {
	characterId: CHARACTER_ID,
	destinationNodeId: "city",
};

describe("useExitFlow — Teleport Stone (HUD)", () => {
	it("fires straight to the city with an empty bag", async () => {
		const t = setup();
		await act(() => t.flow().stoneToCity());
		expect(t.setPendingArrival).toHaveBeenCalledWith("city");
		expect(t.server.teleportStone).toHaveBeenCalledWith(stoneToCityArgs);
		expect(t.modalOpen()).toBe(false);
	});

	it("does nothing without a stone or while the bag loads", async () => {
		const noStone = setup({ teleportStones: 0 });
		await act(() => noStone.flow().stoneToCity());
		const loading = setup({ bagSize: undefined });
		await act(() => loading.flow().stoneToCity());
		expect(noStone.server.teleportStone).not.toHaveBeenCalled();
		expect(loading.server.teleportStone).not.toHaveBeenCalled();
		expect(loading.modalOpen()).toBe(false);
	});

	it("routes a staged bag through the modal with the phase cap", async () => {
		const t = setup({ bagSize: 10, phase: "combat" });
		await act(() => t.flow().stoneToCity());
		expect(t.modalOpen()).toBe(true);
		expect(t.flow().exitKeepCap).toBe(3);
		expect(t.server.teleportStone).not.toHaveBeenCalled();
	});

	it("fires the pending stone once the modal commit empties the bag", async () => {
		const t = setup({ bagSize: 4, phase: "exploration" });
		await act(() => t.flow().stoneToCity());
		await act(() => t.flow().pickAll(["a"]));
		expect(t.server.exitZone).toHaveBeenCalledWith({
			characterId: CHARACTER_ID,
			keepIds: ["a"],
		});
		expect(t.modalOpen()).toBe(false);
		expect(t.server.teleportStone).toHaveBeenCalledWith(stoneToCityArgs);
	});

	it("drops the pending stone when the player cancels with items left", async () => {
		const t = setup({ bagSize: 4 });
		await act(() => t.flow().stoneToCity());
		await act(() => t.flow().dismissExit());
		expect(t.modalOpen()).toBe(false);
		expect(t.server.teleportStone).not.toHaveBeenCalled();
		await act(() => t.flow().retreat());
		await act(() => t.flow().discardAll());
		expect(t.server.teleportStone).not.toHaveBeenCalled();
	});

	it("fires the stone when a camp pick takes the whole bag", async () => {
		const t = setup({ bagSize: 2, phase: "camp" });
		await act(() => t.flow().stoneToCity());
		expect(t.flow().exitKeepCap).toBe(2);
		await act(() => t.flow().pickSelected(["a", "b"]));
		expect(t.server.pickFromBag).toHaveBeenCalledWith({
			characterId: CHARACTER_ID,
			itemIds: ["a", "b"],
		});
		expect(t.server.exitZone).not.toHaveBeenCalled();
		expect(t.modalOpen()).toBe(false);
		expect(t.server.teleportStone).toHaveBeenCalledTimes(1);
	});

	it("rolls the pending arrival back when the stone fails", async () => {
		const t = setup();
		t.server.teleportStone.mockRejectedValueOnce(new Error("nope"));
		await act(() => t.flow().stoneToCity());
		expect(t.setPendingArrival).toHaveBeenLastCalledWith(null);
		expect(t.flow().isUsingTeleportStone).toBe(false);
	});

	it("ignores a second click while the stone is in flight", async () => {
		const t = setup();
		let release = () => {};
		t.server.teleportStone.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					release = () => resolve({});
				}),
		);
		let first: Promise<unknown> = Promise.resolve();
		await act(async () => {
			first = t.flow().stoneToCity();
		});
		expect(t.flow().isUsingTeleportStone).toBe(true);
		await act(() => t.flow().stoneToCity());
		release();
		await act(() => first);
		expect(t.server.teleportStone).toHaveBeenCalledTimes(1);
	});
});

describe("useExitFlow — Retreat", () => {
	it("waits while the bag loads", async () => {
		const t = setup({ bagSize: undefined });
		await act(() => t.flow().retreat());
		expect(t.backToMap).not.toHaveBeenCalled();
		expect(t.server.exitZone).not.toHaveBeenCalled();
	});

	it("leaves with nothing kept when the bag is empty", async () => {
		const t = setup();
		await act(() => t.flow().retreat());
		expect(t.backToMap).toHaveBeenCalledTimes(1);
		expect(t.server.exitZone).toHaveBeenCalledWith({
			characterId: CHARACTER_ID,
			keepIds: [],
		});
		expect(t.modalOpen()).toBe(false);
	});

	it("goes to the map, then opens the modal for a staged bag", async () => {
		const t = setup({ bagSize: 5, phase: "camp" });
		await act(() => t.flow().retreat());
		expect(t.backToMap).toHaveBeenCalledTimes(1);
		expect(t.modalOpen()).toBe(true);
		expect(t.flow().exitKeepCap).toBe(5);
		expect(t.server.exitZone).not.toHaveBeenCalled();
	});
});

describe("useExitFlow — exit modal actions", () => {
	it("commits a non-camp selection through exitZone and closes", async () => {
		const t = setup({ bagSize: 10, phase: "combat" });
		await act(() => t.flow().retreat());
		await act(() => t.flow().pickSelected(["a", "b"]));
		expect(t.server.pickFromBag).not.toHaveBeenCalled();
		expect(t.server.exitZone).toHaveBeenCalledWith({
			characterId: CHARACTER_ID,
			keepIds: ["a", "b"],
		});
		expect(t.modalOpen()).toBe(false);
	});

	it("keeps the modal open on a partial camp pick", async () => {
		const t = setup({ bagSize: 3, phase: "camp" });
		await act(() => t.flow().retreat());
		await act(() => t.flow().pickSelected(["a"]));
		expect(t.server.pickFromBag).toHaveBeenCalledTimes(1);
		expect(t.modalOpen()).toBe(true);
	});

	it("discards a selection only inside a camp", async () => {
		const camp = setup({ bagSize: 2, phase: "camp" });
		await act(() => camp.flow().retreat());
		await act(() => camp.flow().discardSelected(["a", "b"]));
		expect(camp.server.discardFromBag).toHaveBeenCalledWith({
			characterId: CHARACTER_ID,
			itemIds: ["a", "b"],
		});
		expect(camp.modalOpen()).toBe(false);

		const field = setup({ bagSize: 2, phase: "combat" });
		await act(() => field.flow().discardSelected(["a"]));
		expect(field.server.discardFromBag).not.toHaveBeenCalled();
	});

	it("closes the modal at once, before the server answers the commit", async () => {
		const t = setup({ bagSize: 4, phase: "combat" });
		let answer = () => {};
		t.server.exitZone.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					answer = () => resolve({});
				}),
		);
		await act(() => t.flow().retreat());
		let commit: Promise<void> = Promise.resolve();
		act(() => {
			commit = t.flow().pickAll(["a"]);
		});
		expect(t.modalOpen()).toBe(false);
		await act(async () => {
			answer();
			await commit;
		});
		expect(t.modalOpen()).toBe(false);
	});

	it("sends a double-clicked commit once", async () => {
		const t = setup({ bagSize: 4, phase: "combat" });
		await act(() => t.flow().retreat());
		await act(() =>
			Promise.all([t.flow().pickAll(["a"]), t.flow().pickAll(["a"])]),
		);
		expect(t.server.exitZone).toHaveBeenCalledTimes(1);
	});

	it("reopens the modal when a commit fails", async () => {
		const t = setup({ bagSize: 4, phase: "combat" });
		t.server.exitZone.mockRejectedValueOnce(new Error("Inventory full"));
		await act(() => t.flow().retreat());
		await act(() => t.flow().pickAll(["a"]));
		expect(t.modalOpen()).toBe(true);
	});

	it("keeps the pending stone for the retry when a commit fails", async () => {
		const t = setup({ bagSize: 4, phase: "combat" });
		t.server.exitZone.mockRejectedValueOnce(new Error("Inventory full"));
		await act(() => t.flow().stoneToCity());
		await act(() => t.flow().pickAll(["a"]));
		expect(t.server.teleportStone).not.toHaveBeenCalled();
		await act(() => t.flow().pickAll(["a"]));
		expect(t.server.teleportStone).toHaveBeenCalledExactlyOnceWith(
			stoneToCityArgs,
		);
	});

	it("closes on a dismiss of an emptied bag without a pending stone", async () => {
		const t = setup({ bagSize: 1, phase: "camp" });
		await act(() => t.flow().retreat());
		t.hook.rerender({ bagSize: 0, phase: "camp", teleportStones: 1 });
		await act(() => t.flow().dismissExit());
		expect(t.modalOpen()).toBe(false);
		expect(t.server.teleportStone).not.toHaveBeenCalled();
	});
});
