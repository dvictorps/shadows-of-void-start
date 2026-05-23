import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import CityScene from "#/components/world/CityScene";
import CombatScene, {
	type ConsumableKey,
} from "#/components/world/CombatScene";
import EquipmentPanel from "#/components/world/EquipmentPanel";
import MapScene from "#/components/world/MapScene";
import ShowStatsModal from "#/components/world/ShowStatsModal";
import StatusCard from "#/components/world/StatusCard";
import TextLog from "#/components/world/TextLog";
import TravelProgressBar from "#/components/world/TravelProgressBar";
import { WorldModals } from "#/components/world/WorldModals";
import { findClassDefinition } from "#/game/classes/data";
import { computeBagKeepCap } from "#/game/combat/constants";
import { xpToNextLevel } from "#/game/progression/levels";
import { computeCharacterStats } from "#/game/stats/compute";
import {
	type EquippedItem,
	type EquippedSlot,
	narrowEquippedSlot,
} from "#/game/stats/types";
import { ACT_1, findNode } from "#/game/world";
import { DEFAULT_ENCOUNTER_PLAN } from "#/game/world/encounter-schedule";
import { translateNodeDescription, translateNodeName } from "#/game/world/i18n";
import { useCachedQuery } from "#/hooks/useCachedQuery";
import { useCombatLoop } from "#/hooks/useCombatLoop";
import { useConfirmationModal } from "#/hooks/useConfirmationModal";
import { useModal } from "#/hooks/useModal";
import { useViewMode } from "#/hooks/useViewMode";
import { useWorldMutations } from "#/hooks/useWorldMutations";
import { convexErrorMessage } from "#/lib/convex-errors";
import { m } from "#/paraglide/messages";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";

const searchSchema = z.object({
	characterId: z.string(),
});

const CONSUMABLE_DESCRIPTIONS: Record<ConsumableKey, () => string> = {
	potion: m.consumable_desc_potion,
	teleport: m.consumable_desc_teleport,
	incense: m.incense_hint,
};

export const Route = createFileRoute("/world")({
	validateSearch: searchSchema,
	beforeLoad: ({ context }) => {
		if (!context.isAuthenticated) {
			throw redirect({ to: "/sign-in" });
		}
	},
	component: WorldView,
});

function WorldView() {
	const { characterId } = Route.useSearch();
	const navigate = useNavigate();
	const characters = useQuery(api.characters.list);
	const character = characters?.find((c) => c._id === characterId);

	const charactersLoaded = characters !== undefined;
	const missing = charactersLoaded && !character;

	useEffect(() => {
		if (missing) void navigate({ to: "/character-select" });
	}, [missing, navigate]);

	if (!charactersLoaded || !character) {
		return (
			<main className="flex h-screen items-center justify-center bg-black text-white">
				<p className="text-xs uppercase tracking-[0.2em] text-neutral-600">
					{m.loading()}
				</p>
			</main>
		);
	}

	return <WorldLayout character={character} />;
}

// Stable identity for the "no thresholds yet" case — Convex reactive queries
// return undefined briefly between mount and the first enterZone result. A
// fresh `?? []` would allocate a new reference per render, retriggering the
// downstream ref-sync useEffect in useEncounterSchedule for no reason.
const EMPTY_THRESHOLDS: readonly number[] = [];

function WorldLayout({ character }: { character: Doc<"characters"> }) {
	const navigate = useNavigate();
	const confirm = useConfirmationModal();
	const classDef = findClassDefinition(character.classId);

	const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
	const [deathLog, setDeathLog] = useState<string | null>(null);
	const [consumableHover, setConsumableHover] = useState<ConsumableKey | null>(
		null,
	);
	const bagModal = useModal();
	const exitModal = useModal();
	const inventoryModal = useModal();
	const settingsModal = useModal();
	const statsModal = useModal();
	const vendorModal = useModal();
	const currentLocation = character.currentLocation ?? "city";
	const currentNode = findNode(ACT_1, currentLocation);
	const hoveredNode = hoveredNodeId ? findNode(ACT_1, hoveredNodeId) : null;
	const travelDestination = character.travelDestination;
	const travelArrivesAt = character.travelArrivesAt;

	// Always-on subscriptions (lifted from InventoryModal so the queries are
	// warm whenever the modal opens — no flicker on first open). Combined with
	// the localStorage cache below, cold reloads also render last-known data
	// instantly.
	const liveEquipped = useQuery(api.items.equipped, {
		characterId: character._id,
	});
	const liveInventory = useQuery(api.items.inventory, {
		characterId: character._id,
	});
	const equippedItems = useCachedQuery(
		`equipped:${character._id}`,
		liveEquipped,
	);
	const inventoryItems = useCachedQuery(
		`inventory:${character._id}`,
		liveInventory,
	);

	const equippedSnapshot: EquippedItem[] = useMemo(() => {
		const out: EquippedItem[] = [];
		for (const item of equippedItems ?? []) {
			const slot = narrowEquippedSlot(item.equippedSlot);
			if (!slot) continue;
			out.push({ slot, item: item.data });
		}
		return out;
	}, [equippedItems]);

	const stats = useMemo(
		() =>
			computeCharacterStats({
				classDef,
				level: character.level,
				equippedItems: equippedSnapshot,
			}),
		[classDef, character.level, equippedSnapshot],
	);

	const maxHp = stats.maxLife;

	const {
		enterCity,
		enterZone,
		exitZone,
		pickFromBag,
		discardFromBag,
		respawnDead,
		startTravel,
		arriveAtTravel,
		vendorBuy,
		teleportStone,
		vendorSellMany,
	} = useWorldMutations({ movementSpeed: stats.movementSpeed });

	const { view, setView, setPendingArrival, isTraveling, enterDestination } =
		useViewMode({
			characterId: character._id,
			currentLocation,
			travelDestination,
			travelArrivesAt,
			enterCity,
			enterZone,
			arriveAtTravel,
			onEnterNewArea: () => setDeathLog(null),
		});

	const wantsBag = view === "combat" || exitModal.isOpen;
	const zoneBag = useQuery(
		api.items.zoneBag,
		wantsBag ? { characterId: character._id } : "skip",
	);

	const equippedBySlot = useMemo<
		ReadonlyMap<EquippedSlot, { id: string; data: EquippedItem["item"] }>
	>(() => {
		const map = new Map<
			EquippedSlot,
			{ id: string; data: EquippedItem["item"] }
		>();
		for (const eq of equippedSnapshot) {
			map.set(eq.slot, { id: eq.item.id, data: eq.item });
		}
		return map;
	}, [equippedSnapshot]);
	const monsterPool = useMemo(
		() => currentNode?.monsterPool ?? [],
		[currentNode],
	);
	const zoneLevel = currentNode?.level ?? character.level;
	const encounterPlan = currentNode?.encounterPlan ?? DEFAULT_ENCOUNTER_PLAN;

	const handlePlayerDeath = useCallback(async () => {
		try {
			const result = await respawnDead({ characterId: character._id });
			if (result.mode === "softcore") {
				const message = m.you_died_softcore({ xp: result.xpLost });
				setDeathLog(message);
				// Respawn in the city — server resets currentLocation to "city" and
				// clears travel state. View follows.
				setView("city");
				setPendingArrival(null);
				toast.error(message);
			} else {
				toast.error(m.you_died_hardcore());
				window.location.href = "/character-select";
			}
		} catch {
			toast.error(m.failed_handle_death());
		}
	}, [respawnDead, character._id, setView, setPendingArrival]);

	const combat = useCombatLoop({
		characterId: character._id,
		characterLevel: character.level,
		stats,
		initialHp: character.hpCurrent ?? maxHp,
		potions: character.potions ?? 0,
		incense: character.etherealIncense ?? 0,
		monsterPool,
		zoneLevel,
		encounterPlan,
		// Camp thresholds are server-rolled by enterZone; the time bar reads
		// them off the character query so the markers and the ticker stay
		// in lockstep with what enterCamp will accept. See
		// docs/plans/in-progress.md "Server-authoritative camp/phase
		// derivation".
		serverCampThresholdsMs: character.campThresholdsMs ?? EMPTY_THRESHOLDS,
		// Pause combat while the loot picker is open so the player can't die
		// mid-selection from a goblin they've already retreated from.
		active: view === "combat" && !exitModal.isOpen,
		onPlayerDeath: handlePlayerDeath,
	});

	// Bag retention cap by exit phase, frozen at modal-open time so
	// incremental picks don't dilute the 30% punishment ("bag shrinks each
	// pick → cap recomputes lower → effective share grows"). Reset when
	// the modal closes. Math lives in `computeBagKeepCap` so the client
	// preview can't drift from the server's enforcement.
	const [exitKeepCap, setExitKeepCap] = useState(0);

	// In-flight tracking for spam-clickable action handlers. Mirrors the
	// VendorModal pattern from PR #45: early-return + try/finally inside the
	// handler, button disabled while the mutation is pending, state reset on
	// the natural close boundary (view change). The mutation hooks stay
	// mutation-only — UX guards live with the consumer.
	const [isUsingPotion, setIsUsingPotion] = useState(false);
	const [isUsingTeleportStone, setIsUsingTeleportStone] = useState(false);
	const [isUsingIncense, setIsUsingIncense] = useState(false);
	const [isEnteringNode, setIsEnteringNode] = useState(false);
	const [isRetreating, setIsRetreating] = useState(false);

	// Reset the in-flight flags whenever the view transitions. A slow request
	// finishing after the player has navigated away (e.g. retreat → map) must
	// not leave the next visit's button stuck disabled. The handlers' own
	// try/finally already clears on normal completion; this is the safety net
	// for the "mid-flight close" window.
	// biome-ignore lint/correctness/useExhaustiveDependencies: setters are stable; we only want this to fire on view changes.
	useEffect(() => {
		setIsUsingPotion(false);
		setIsUsingTeleportStone(false);
		setIsUsingIncense(false);
		setIsEnteringNode(false);
		setIsRetreating(false);
	}, [view]);

	const unlockedNodeIds = useMemo(
		() => new Set(character.unlockedNodes ?? ["city"]),
		[character.unlockedNodes],
	);
	const completedZoneIds = useMemo(
		() => new Set(character.completedZones ?? []),
		[character.completedZones],
	);

	const handleEnterNode = async (nodeId: string) => {
		// Spam-click guard: `pendingArrival` catches subsequent clicks once it's
		// set, but the click → confirm → setPendingArrival flow leaves a small
		// window where two clicks could both fire startTravel. Bail synchronously
		// on re-entry.
		if (isEnteringNode) return;
		if (isTraveling) return;
		// Re-entering the current node skips travel — the player is already there.
		if (nodeId === currentLocation) {
			enterDestination(nodeId);
			return;
		}
		setIsEnteringNode(true);
		try {
			// Otherwise the click intent is "travel there and enter on arrival".
			const fromNode = findNode(ACT_1, currentLocation);
			const conn = fromNode?.connections.find((c) => c.id === nodeId);
			if (!conn) {
				// Not directly connected. If the destination is unlocked AND the
				// player has a teleport stone, offer the jump. Otherwise fail with
				// the existing no-route toast.
				const destNode = findNode(ACT_1, nodeId);
				const destName = destNode ? translateNodeName(destNode) : nodeId;
				const stones = character.teleportStones ?? 0;
				if (!unlockedNodeIds.has(nodeId) || stones <= 0) {
					toast.error(m.travel_no_route({ destination: destName }));
					return;
				}
				const ok = await confirm({
					title: m.wind_crystal_confirm_title(),
					message: m.wind_crystal_confirm_message({
						destination: destName,
						remaining: stones,
					}),
					confirmLabel: m.wind_crystal_use_action(),
					cancelLabel: m.cancel(),
				});
				if (!ok) return;
				// The stone branch shares the teleport-stone in-flight flag with
				// the HUD path so spamming map + HUD can't fire two stones.
				if (isUsingTeleportStone) return;
				setIsUsingTeleportStone(true);
				setPendingArrival(nodeId);
				try {
					await teleportStone({
						characterId: character._id,
						destinationNodeId: nodeId,
					});
				} catch (err) {
					setPendingArrival(null);
					toast.error(convexErrorMessage(err, m.wind_crystal_failed()));
				} finally {
					setIsUsingTeleportStone(false);
				}
				return;
			}
			setPendingArrival(nodeId);
			try {
				await startTravel({
					characterId: character._id,
					destinationNodeId: nodeId,
				});
			} catch {
				setPendingArrival(null);
			}
		} finally {
			setIsEnteringNode(false);
		}
	};

	// Set while the exit modal is acting as the bag-handling step for a stone
	// jump. Cleared on cancel or after the stone fires.
	const pendingStoneRef = useRef(false);

	const fireStoneToCity = async () => {
		setIsUsingTeleportStone(true);
		setPendingArrival("city");
		try {
			await teleportStone({
				characterId: character._id,
				destinationNodeId: "city",
			});
		} catch (err) {
			setPendingArrival(null);
			toast.error(convexErrorMessage(err, m.teleport_stone_failed()));
		} finally {
			setIsUsingTeleportStone(false);
		}
	};

	const handleUseTeleportStone = async () => {
		// Spam-click guard: fast double-taps could fire two stones before the
		// optimistic count decrement reaches the UI. Single in-flight flag
		// covers both this entry point and the map-click `handleEnterNode`
		// stone branch so the two routes can't race each other.
		if (isUsingTeleportStone) return;
		if (exitModal.isOpen) return;
		const stones = character.teleportStones ?? 0;
		if (stones <= 0) return;
		if (zoneBag === undefined) return;
		// The HUD button always sends to city — the panic-return contract.
		// Non-city destinations come through `handleEnterNode` instead.
		// Bag with items routes through the exit modal so the player keeps
		// their phase-capped share (camp → 100%, exploração/combate → 30%).
		// See CONTEXT.md → Bag retention tiers.
		if (zoneBag.length > 0) {
			pendingStoneRef.current = true;
			setExitKeepCap(computeBagKeepCap(zoneBag.length, combat.phase));
			exitModal.open();
			return;
		}
		await fireStoneToCity();
	};

	const handleBackToMap = () => {
		setView("map");
	};

	const handleRetreat = async () => {
		// Spam-click guard: the retreat button unmounts on view change, but a
		// fast double-tap during the render-cycle window between click and
		// unmount could fire `exitZone` twice. Early-return on re-entry.
		if (isRetreating) return;
		// Wait for the bag query to resolve before deciding modal vs auto-exit —
		// otherwise an undefined (still-loading) bag silently discards the loot.
		if (zoneBag === undefined) return;
		if (zoneBag.length > 0) {
			// Bag path is modal-driven; the modal's own buttons carry their own
			// in-flight tracking. No async work here beyond opening the modal.
			handleBackToMap();
			setExitKeepCap(computeBagKeepCap(zoneBag.length, combat.phase));
			exitModal.open();
			return;
		}
		setIsRetreating(true);
		handleBackToMap();
		try {
			// TODO(merge): drop phase arg — server derives it from inCamp now.
			await exitZone({
				characterId: character._id,
				keepIds: [],
				phase: combat.phase,
			});
		} finally {
			setIsRetreating(false);
		}
	};

	const handlePickSelected = async (ids: Id<"items">[]) => {
		// Camp: incremental pick. Modal stays open until bag empties.
		// Non-camp: one-shot commit via exitZone — bag is wiped, modal closes.
		// Routing here matches the server gate (pickFromBag rejects non-camp).
		try {
			if (combat.phase === "camp") {
				// TODO(merge): drop phase arg — server derives it from inCamp now.
				await pickFromBag({
					characterId: character._id,
					itemIds: ids,
					phase: combat.phase,
				});
			} else {
				// TODO(merge): drop phase arg — server derives it from inCamp now.
				await exitZone({
					characterId: character._id,
					keepIds: ids,
					phase: combat.phase,
				});
				exitModal.close();
			}
		} catch (err) {
			toast.error(convexErrorMessage(err, m.inventory_full_error()));
		}
	};

	const handleDiscardSelected = async (ids: Id<"items">[]) => {
		// Camp-only action — the modal hides the button outside camp.
		if (combat.phase !== "camp") return;
		// TODO(merge): drop phase arg — server derives it from inCamp now.
		await discardFromBag({
			characterId: character._id,
			itemIds: ids,
			phase: combat.phase,
		});
	};

	const handlePickAll = async (ids: Id<"items">[]) => {
		try {
			// TODO(merge): drop phase arg — server derives it from inCamp now.
			await exitZone({
				characterId: character._id,
				keepIds: ids,
				phase: combat.phase,
			});
			exitModal.close();
		} catch (err) {
			toast.error(convexErrorMessage(err, m.inventory_full_error()));
		}
	};

	const handleDiscardAll = async () => {
		// TODO(merge): drop phase arg — server derives it from inCamp now.
		await exitZone({
			characterId: character._id,
			keepIds: [],
			phase: combat.phase,
		});
		exitModal.close();
	};

	const handleCloseExit = async () => {
		// All exit paths funnel here — the explicit Get-all / Discard-all
		// handlers call exitModal.close() which fires this via onClose, and
		// the modal also auto-closes when incremental picks empty the bag.
		// When a stone was pending and the bag is empty, fire the stone.
		// An empty close with a non-empty bag is a user cancel — clear the
		// pending flag and leave the bag; the next enterZone purges any
		// orphan session.
		const wasPendingStone = pendingStoneRef.current;
		pendingStoneRef.current = false;
		exitModal.close();
		if (wasPendingStone && zoneBag && zoneBag.length === 0) {
			await fireStoneToCity();
		}
	};

	// Spam-click guard around `combat.usePotion`. The local `potions` count
	// already optimistically decrements, but a fast double-tap before the
	// optimistic update reaches React can fire `consumePotion` twice and the
	// second call gets rejected. Early-return + try/finally + button disabled.
	const handleUsePotion = async () => {
		if (isUsingPotion) return;
		setIsUsingPotion(true);
		try {
			// `combat.usePotion` is the consumer-facing potion action returned
			// from `useCombatTick`. The `use` prefix is incidental — it's a
			// regular async function, not a React hook. See the same alias
			// rationale on `teleportStone` in useWorldMutations.ts.
			// biome-ignore lint/correctness/useHookAtTopLevel: not a React hook.
			await combat.usePotion();
		} finally {
			setIsUsingPotion(false);
		}
	};

	// Spam-click guard around `combat.triggerIncense`. Unlike potion/teleport,
	// `triggerIncense` is synchronous (fires a mutation without awaiting),
	// so we anchor the in-flight reset to the optimistic `combat.incense`
	// count change rather than a try/finally. The count decrement happens
	// on the same render the mutation fires; if it reverts, the count goes
	// back up and the watcher effect (below) still clears the flag.
	const handleUseIncense = () => {
		if (isUsingIncense) return;
		if (combat.incense <= 0) return;
		setIsUsingIncense(true);
		combat.triggerIncense();
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: only the count change should clear the flag.
	useEffect(() => {
		setIsUsingIncense(false);
	}, [combat.incense]);

	// TextLog priority: death > consumable hover (combat) > low-HP warning >
	// hovered node description (map view) > map idle (act label) > current
	// zone (combat/city) > generic fallback. XP gains now surface as a
	// floating popup over the enemy area instead of the log.
	const lowHpThreshold = maxHp * 0.3;
	const isLowHp =
		view === "combat" &&
		combat.playerHp > 0 &&
		combat.playerHp < lowHpThreshold;
	let logMessage: string | undefined;
	let logTone: "info" | "warning" | "success" | "danger" = "info";
	if (deathLog) {
		logMessage = deathLog;
		logTone = "danger";
	} else if (view === "combat" && consumableHover) {
		logMessage = CONSUMABLE_DESCRIPTIONS[consumableHover]();
	} else if (isLowHp) {
		logMessage =
			combat.potions > 0 ? m.low_hp_use_potion() : m.low_hp_no_potions();
		logTone = "warning";
	} else if (view === "map" && hoveredNode) {
		logMessage =
			translateNodeDescription(hoveredNode) ?? translateNodeName(hoveredNode);
	} else if (view === "map") {
		logMessage = m.act_map_label({ number: 1 });
	} else if (currentNode) {
		logMessage = m.inside_zone({ zone: translateNodeName(currentNode) });
	}

	const hpOverride = view === "combat" ? combat.playerHp : undefined;
	const barrierOverride =
		view === "combat" ? combat.barrier.current : undefined;
	const potionsOverride = view === "combat" ? combat.potions : undefined;
	// Pass the wrapped handler when allowed; when an in-flight call is
	// pending, clear it so StatusCard's internal `canUsePotion` check disables
	// its button without needing a new prop. CombatScene receives the handler
	// + an explicit `canUsePotion` that ANDs in the same flag.
	const onUsePotion =
		(view === "combat" || view === "map") && !isUsingPotion
			? handleUsePotion
			: undefined;

	const handleLeaveWorld = async () => {
		const ok = await confirm({
			title: m.leave_world_title(),
			message: m.leave_world_message(),
			confirmLabel: m.leave_world_confirm(),
			cancelLabel: m.cancel(),
		});
		if (!ok) return;
		void navigate({ to: "/character-select" });
	};

	// Pre-compute the travel overlay so the JSX stays readable. Renders only
	// when both source + destination nodes resolve (defensive — they should
	// always exist since the server validated the route on `startTravel`).
	const travelFromNode = currentNode;
	const travelToNode = travelDestination
		? findNode(ACT_1, travelDestination)
		: null;
	const travelOverlay =
		isTraveling &&
		travelArrivesAt !== undefined &&
		travelFromNode &&
		travelToNode ? (
			<TravelProgressBar
				key={travelDestination}
				fromName={translateNodeName(travelFromNode)}
				toName={translateNodeName(travelToNode)}
				arrivesAtMs={travelArrivesAt}
			/>
		) : null;

	return (
		<main className="relative grid h-screen grid-cols-[1fr_640px] gap-3 overflow-hidden bg-black p-3 text-white">
			{view === "map" && (
				<button
					type="button"
					onClick={handleLeaveWorld}
					aria-label={m.leave_world_back_label()}
					className="absolute top-5 left-5 z-20 inline-flex items-center gap-1.5 border border-white/40 bg-black px-3 py-1.5 font-medium text-[10px] text-white/80 uppercase tracking-wider transition hover:border-white hover:bg-white/10 hover:text-white"
				>
					<ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
					{m.back()}
				</button>
			)}
			<div className="grid grid-rows-[1fr_160px] gap-3 overflow-hidden">
				{view === "map" && (
					<div className="relative overflow-hidden">
						<MapScene
							act={ACT_1}
							onEnterNode={handleEnterNode}
							onHoverNode={setHoveredNodeId}
							hoveredNodeId={hoveredNodeId}
							currentLocationNodeId={currentLocation}
							unlockedNodeIds={unlockedNodeIds}
							completedZoneIds={completedZoneIds}
							hasTeleportStone={(character.teleportStones ?? 0) > 0}
							onOpenSettings={settingsModal.open}
						/>
						{travelOverlay}
					</div>
				)}
				{view === "city" && currentNode && (
					<CityScene
						cityName={translateNodeName(currentNode)}
						onLeave={handleBackToMap}
						onOpenVendor={vendorModal.open}
					/>
				)}
				{view === "combat" && currentNode && (
					<CombatScene
						zoneName={translateNodeName(currentNode)}
						zoneLevel={zoneLevel}
						state={combat.state}
						bossIntroStage={combat.bossIntroStage}
						enemy={combat.enemy}
						events={combat.events}
						playerHp={combat.playerHp}
						maxHp={maxHp}
						barrier={combat.barrier.current}
						maxBarrier={combat.barrier.max}
						xp={character.xp ?? 0}
						xpNeeded={xpToNextLevel(character.level)}
						lastKillXp={combat.lastKill?.xp}
						potions={combat.potions}
						canUsePotion={
							combat.potions > 0 && combat.playerHp < maxHp && !isUsingPotion
						}
						onUsePotion={handleUsePotion}
						teleportStones={character.teleportStones ?? 0}
						canUseTeleportStone={
							(character.teleportStones ?? 0) > 0 && !isUsingTeleportStone
						}
						onUseTeleportStone={handleUseTeleportStone}
						incense={combat.incense}
						canUseIncense={
							combat.incense > 0 &&
							combat.state !== "boss_intro" &&
							combat.state !== "acampamento" &&
							combat.state !== "miniboss_victory" &&
							!(
								combat.state === "engaged" && combat.enemy?.rarity === "rare"
							) &&
							!combat.ambushActive &&
							!isUsingIncense
						}
						onUseIncense={handleUseIncense}
						campSource={combat.campSource}
						ambushActive={combat.ambushActive}
						onRetreat={handleRetreat}
						bagCount={zoneBag?.length ?? 0}
						onOpenBag={bagModal.open}
						onConsumableHover={setConsumableHover}
						calmariaElapsedMs={combat.calmariaElapsedMs}
						calmariaBudgetMs={combat.calmariaBudgetMs}
						campThresholdsMs={combat.campThresholdsMs}
						onDismissMinibossModal={combat.dismissMinibossModal}
						zoneId={currentNode.id}
						onDismissCamp={combat.dismissCamp}
					/>
				)}
				<TextLog message={logMessage} tone={logTone} />
			</div>

			<aside className="grid grid-rows-[1fr_auto] gap-3">
				<EquipmentPanel
					equippedBySlot={equippedBySlot}
					stats={stats}
					characterLevel={character.level}
					rubys={character.rubys ?? 0}
					onOpenInventory={inventoryModal.open}
				/>
				<StatusCard
					character={character}
					classDef={classDef}
					stats={stats}
					hpOverride={hpOverride}
					barrierOverride={barrierOverride}
					potionsOverride={potionsOverride}
					teleportStones={character.teleportStones ?? 0}
					onUsePotion={onUsePotion}
					onUseTeleportStone={
						isUsingTeleportStone ? undefined : handleUseTeleportStone
					}
					onShowStats={statsModal.open}
				/>
			</aside>

			<WorldModals
				bagModal={bagModal}
				exitModal={exitModal}
				inventoryModal={inventoryModal}
				vendorModal={vendorModal}
				settingsModal={settingsModal}
				zoneBag={zoneBag ?? []}
				exitKeepCap={exitKeepCap}
				onExitClose={handleCloseExit}
				onPickSelected={handlePickSelected}
				onDiscardSelected={handleDiscardSelected}
				onPickAll={handlePickAll}
				onDiscardAll={handleDiscardAll}
				stats={stats}
				characterId={character._id}
				characterLevel={character.level}
				equippedItems={equippedItems ?? []}
				inventoryItems={inventoryItems ?? []}
				rubys={character.rubys ?? 0}
				potions={character.potions ?? 0}
				teleportStones={character.teleportStones ?? 0}
				onVendorBuy={async (productId) => {
					await vendorBuy({ characterId: character._id, productId });
				}}
				onVendorSellMany={async (itemIds) => {
					await vendorSellMany({ characterId: character._id, itemIds });
				}}
			/>
			{/* Gated mount (unique among the modals): currentBarrier/currentLife
				change every 50ms combat tick, so unmounting when closed avoids
				re-evaluating the stats subtree on every tick. */}
			{statsModal.isOpen && (
				<ShowStatsModal
					isOpen
					onClose={statsModal.close}
					stats={stats}
					referenceEnemyLevel={zoneLevel}
					currentBarrier={combat.barrier.current}
					currentLife={combat.playerHp}
				/>
			)}
		</main>
	);
}
