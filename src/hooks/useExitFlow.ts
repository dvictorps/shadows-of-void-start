// ─────────────────────────────────────────────────────────────────────────────
//  The zone-exit flow of the /world route: Retreat, the HUD Teleport Stone,
//  and the exit modal that sits between a staged bag and leaving.
//
//  - Retreat and the stone share `planZoneExit`: wait for the bag, leave
//    straight away when it's empty, otherwise open the exit modal with the
//    phase's keep cap frozen at open time.
//  - A stone that hits a staged bag waits in `pendingStoneRef`; the stone
//    fires when the modal closes on an emptied bag, and is dropped when the
//    player cancels with items still in it.
//  - The server calls come in as `server`, so the tests drive the flow with
//    fakes. See CONTEXT.md → Bag retention tiers and → Inventory overflow and
//    exit-modal flow.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState } from "react";
import { toast } from "sonner";

import type { CombatPhase } from "#/game/combat/constants";
import { planZoneExit } from "#/game/combat/zone-exit";
import type { WorldViewMode } from "#/game/world";
import type { ModalHandle } from "#/hooks/useModal";
import { serverErrorMessage } from "#/lib/server-error-message";
import { m } from "#/paraglide/messages";

import { useInFlight } from "./useInFlight";
import type { useWorldMutations } from "./useWorldMutations";

type WorldMutations = ReturnType<typeof useWorldMutations>;
type ArgsOf<Name extends keyof WorldMutations> = Parameters<
	WorldMutations[Name]
>[0];

/** The world calls the exit flow makes; the route passes `useWorldMutations`. */
export interface ExitFlowServer {
	exitZone: (args: ArgsOf<"exitZone">) => Promise<object>;
	pickFromBag: (args: ArgsOf<"pickFromBag">) => Promise<object>;
	discardFromBag: (args: ArgsOf<"discardFromBag">) => Promise<object>;
	teleportStone: (args: ArgsOf<"teleportStone">) => Promise<object>;
}

export function useExitFlow({
	characterId,
	view,
	bagSize,
	phase,
	teleportStones,
	exitModal,
	server,
	backToMap,
	setPendingArrival,
}: {
	characterId: number;
	// Resets the spam-click flags on a view change, so a slow request that
	// finishes after navigating away doesn't leave the next visit stuck.
	view: WorldViewMode;
	// Items staged in the zone bag; `undefined` while the bag query loads.
	bagSize: number | undefined;
	phase: CombatPhase;
	teleportStones: number;
	exitModal: ModalHandle;
	server: ExitFlowServer;
	backToMap: () => void;
	setPendingArrival: (nodeId: string | null) => void;
}) {
	const { exitZone, pickFromBag, discardFromBag, teleportStone } = server;

	// Bag retention cap, frozen when the modal opens so incremental picks
	// don't dilute the 30% punishment ("bag shrinks each pick → cap recomputes
	// lower → effective share grows").
	const [exitKeepCap, setExitKeepCap] = useState(0);
	// Set while the exit modal is acting as the bag-handling step for a stone
	// jump. Cleared on cancel or after the stone fires.
	const pendingStoneRef = useRef(false);

	// The stone flag is shared with the map's stone jump (the route's
	// `handleEnterNode`), so a HUD stone and a map stone can't both fire. The
	// retreat flag covers both its branches (modal-open + exitZone) so a fast
	// double-tap can't double-open the modal or double-fire exitZone.
	const [isUsingTeleportStone, runUseTeleportStone] = useInFlight(view);
	const runRetreat = useInFlight(view)[1];

	const fireStoneToCity = () =>
		runUseTeleportStone(async () => {
			setPendingArrival("city");
			try {
				await teleportStone({ characterId, destinationNodeId: "city" });
			} catch (err) {
				setPendingArrival(null);
				toast.error(serverErrorMessage(err, m.teleport_stone_failed()));
			}
		});

	const openExitModal = (keepCap: number) => {
		setExitKeepCap(keepCap);
		exitModal.open();
	};

	// The HUD button always sends to the city: the panic-return contract.
	// Non-city destinations come through the map's stone jump instead.
	const stoneToCity = async () => {
		// The modal-open path doesn't go through `runUseTeleportStone`, so this
		// check stops a second click from re-opening the modal while the first
		// click's stone is still in flight.
		if (isUsingTeleportStone || exitModal.isOpen) return;
		if (teleportStones <= 0) return;
		const plan = planZoneExit(bagSize, phase);
		if (plan.kind === "wait") return;
		if (plan.kind === "pick") {
			pendingStoneRef.current = true;
			openExitModal(plan.keepCap);
			return;
		}
		await fireStoneToCity();
	};

	const retreat = () =>
		runRetreat(async () => {
			const plan = planZoneExit(bagSize, phase);
			if (plan.kind === "wait") return;
			// The view goes to the map before the modal opens, so the modal's
			// Cancel lands on the map (CONTEXT.md → Inventory overflow and
			// exit-modal flow).
			backToMap();
			if (plan.kind === "pick") {
				openExitModal(plan.keepCap);
				return;
			}
			await exitZone({ characterId, keepIds: [] });
		});

	// Single close path for the exit modal: the player's own dismiss, the camp
	// selection handlers that just emptied the bag, and the exitZone commits
	// (which always wipe it). With a stone pending and the bag empty, the stone
	// fires; a close with items left is a cancel that drops the pending stone
	// and keeps the bag (the next enterZone purges any orphan session).
	// `bagEmptied` is passed in because the emptying callers still hold the
	// pre-mutation bag size.
	// Known gap, accepted: if the bag empties from outside these handlers while
	// the modal is open (a server-side purge), the modal stays open on an empty
	// list until dismissed. The only such path today is another tab claiming
	// the session, which already shows SessionLostModal.
	const closeExit = async (bagEmptied: boolean) => {
		const wasPendingStone = pendingStoneRef.current;
		pendingStoneRef.current = false;
		exitModal.close();
		if (wasPendingStone && bagEmptied) await fireStoneToCity();
	};

	// A camp selection that covers the whole bag empties it, so the modal
	// closes right as the optimistic update zeroes the bag ("auto-closes the
	// moment the bag goes to zero", CONTEXT.md). The selection is always a
	// subset of the pre-mutation bag, so equal length = whole bag.
	const selectionEmptiesBag = (ids: string[]) => ids.length === bagSize;

	// Camp: incremental pick, the modal stays open until the bag empties.
	// Elsewhere: one-shot commit through exitZone. Matches the server gate
	// (pickFromBag rejects outside a camp).
	const pickSelected = async (ids: string[]) => {
		try {
			if (phase === "camp") {
				const pick = pickFromBag({ characterId, itemIds: ids });
				if (selectionEmptiesBag(ids)) void closeExit(true);
				await pick;
			} else {
				await exitZone({ characterId, keepIds: ids });
				await closeExit(true);
			}
		} catch (err) {
			toast.error(serverErrorMessage(err, m.inventory_full_error()));
		}
	};

	// Camp-only: the modal hides the button outside a camp.
	const discardSelected = async (ids: string[]) => {
		if (phase !== "camp") return;
		const discard = discardFromBag({ characterId, itemIds: ids });
		if (selectionEmptiesBag(ids)) void closeExit(true);
		await discard;
	};

	const pickAll = async (ids: string[]) => {
		try {
			await exitZone({ characterId, keepIds: ids });
			await closeExit(true);
		} catch (err) {
			toast.error(serverErrorMessage(err, m.inventory_full_error()));
		}
	};

	const discardAll = async () => {
		await exitZone({ characterId, keepIds: [] });
		await closeExit(true);
	};

	const dismissExit = () => closeExit(bagSize === 0);

	return {
		exitKeepCap,
		isUsingTeleportStone,
		runUseTeleportStone,
		stoneToCity,
		retreat,
		dismissExit,
		pickSelected,
		discardSelected,
		pickAll,
		discardAll,
	};
}
