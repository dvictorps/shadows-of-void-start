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
	view: WorldViewMode;
	bagSize: number | undefined;
	phase: CombatPhase;
	teleportStones: number;
	exitModal: ModalHandle;
	server: ExitFlowServer;
	backToMap: () => void;
	setPendingArrival: (nodeId: string | null) => void;
}) {
	const { exitZone, pickFromBag, discardFromBag, teleportStone } = server;

	const [exitKeepCap, setExitKeepCap] = useState(0);
	const pendingStoneRef = useRef(false);
	const committingRef = useRef(false);

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

	const stoneToCity = async () => {
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
			backToMap();
			if (plan.kind === "pick") {
				openExitModal(plan.keepCap);
				return;
			}
			await exitZone({ characterId, keepIds: [] });
		});

	const takePendingStone = () => {
		const wasPending = pendingStoneRef.current;
		pendingStoneRef.current = false;
		exitModal.close();
		return wasPending;
	};

	const closeExit = async (bagEmptied: boolean) => {
		const wasPendingStone = takePendingStone();
		if (wasPendingStone && bagEmptied) await fireStoneToCity();
	};

	const selectionEmptiesBag = (ids: string[]) => ids.length === bagSize;

	const commitExit = async (keepIds: string[]) => {
		if (committingRef.current) return;
		committingRef.current = true;
		const wasPendingStone = takePendingStone();
		try {
			await exitZone({ characterId, keepIds });
		} catch (err) {
			pendingStoneRef.current = wasPendingStone;
			exitModal.open();
			toast.error(serverErrorMessage(err, m.inventory_full_error()));
			return;
		} finally {
			committingRef.current = false;
		}
		if (wasPendingStone) await fireStoneToCity();
	};

	const pickSelected = async (ids: string[]) => {
		if (phase !== "camp") {
			await commitExit(ids);
			return;
		}
		try {
			const pick = pickFromBag({ characterId, itemIds: ids });
			if (selectionEmptiesBag(ids)) void closeExit(true);
			await pick;
		} catch (err) {
			toast.error(serverErrorMessage(err, m.inventory_full_error()));
		}
	};

	const discardSelected = async (ids: string[]) => {
		if (phase !== "camp") return;
		const discard = discardFromBag({ characterId, itemIds: ids });
		if (selectionEmptiesBag(ids)) void closeExit(true);
		await discard;
	};

	const pickAll = (ids: string[]) => commitExit(ids);

	const discardAll = () => commitExit([]);

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
