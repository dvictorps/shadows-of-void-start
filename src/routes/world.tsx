import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import CityScene from "#/components/world/CityScene";
import CombatScene, {
	type ConsumableKey,
} from "#/components/world/CombatScene";
import EquipmentPanel from "#/components/world/EquipmentPanel";
import LeaderboardModal from "#/components/world/LeaderboardModal";
import MapScene from "#/components/world/MapScene";
import SessionLostModal from "#/components/world/SessionLostModal";
import ShowStatsModal from "#/components/world/ShowStatsModal";
import StatusCard from "#/components/world/StatusCard";
import TextLog from "#/components/world/TextLog";
import TravelProgressBar from "#/components/world/TravelProgressBar";
import { WorldModals } from "#/components/world/WorldModals";
import { findClassDefinition } from "#/game/classes/data";
import { makeBarrierState, tickBarrier } from "#/game/combat/barrier";
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
import { useCompactViewport } from "#/hooks/useCompactViewport";
import { useConfirmationModal } from "#/hooks/useConfirmationModal";
import { useInFlight } from "#/hooks/useInFlight";
import { useModal } from "#/hooks/useModal";
import { useSessionedMutation, useSessionToken } from "#/hooks/useSessionToken";
import { useTicker } from "#/hooks/useTicker";
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
	element_fire: m.element_desc_fire,
	element_cold: m.element_desc_cold,
	element_lightning: m.element_desc_lightning,
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
	const character = useQuery(api.characters.byId, {
		id: characterId as Id<"characters">,
	});

	const missing = character === null;

	useEffect(() => {
		if (missing) void navigate({ to: "/character-select" });
	}, [missing, navigate]);

	if (!character) {
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
	const compact = useCompactViewport();
	const classDef = findClassDefinition(character.classId);
	const { sessionToken } = useSessionToken();
	// Gate the combat loop on the active-session check — a stale tab whose
	// claim was stolen by another tab/device shouldn't keep firing recordKill
	// / syncHp into rejection. The combat HUD freezes silently here; the
	// next user-initiated mutation surfaces the "Session lost" modal via the
	// global error handler. See docs/security/threat-model.md → Threat #5.
	const tokenMatches = character.activeSessionToken === sessionToken;

	// Single-active-session reconciliation. A fresh tab arriving directly at
	// /world (refresh, bookmark, restored tab) has no prior claim — auto-fire
	// one. `hasMatched` flips true the first time the reactive query shows
	// our token win; from that point on a divergence means another tab/device
	// stole the session, and `sessionLost` (derived) surfaces the non-
	// dismissible modal. We deliberately do NOT re-claim after a takeover —
	// otherwise the two tabs ping-pong forever; the user must refresh to
	// recover.
	//
	// `useInFlight` belt-and-suspenders: with Convex's stable mutation refs
	// the effect's dep array already gates re-runs to tokenMatches/hasMatched
	// flips, but the guard removes any reliance on that invariant — if a
	// future Convex change makes the mutation ref change identity, the
	// 50ms-tick combat re-render can't burst-fire claims.
	const claimSession = useMutation(api.characters.claimCharacterSession);
	const [hasMatched, setHasMatched] = useState(false);
	const [isClaiming, runClaim] = useInFlight();
	const sessionLost = hasMatched && !tokenMatches;
	useEffect(() => {
		if (tokenMatches) {
			if (!hasMatched) setHasMatched(true);
			return;
		}
		if (hasMatched || isClaiming) return;
		void runClaim(() =>
			claimSession({ characterId: character._id, sessionToken }),
		);
	}, [
		tokenMatches,
		hasMatched,
		isClaiming,
		runClaim,
		claimSession,
		character._id,
		sessionToken,
	]);

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
	const stashModal = useModal();
	const leaderboardModal = useModal();
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
				selectedElement:
					character.selectedElement ??
					(character.classId === "mage" ? "fire" : undefined),
			}),
		[
			classDef,
			character.level,
			equippedSnapshot,
			character.selectedElement,
			character.classId,
		],
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
		switchElement,
		reorderInventory,
		depositToStash,
		withdrawFromStash,
		reorderStash,
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

	const stashMode = character.hardcore ? "hardcore" : "softcore";
	const liveStash = useQuery(
		api.items.stash,
		view !== "combat" ? { stashMode } : "skip",
	);
	const stashItems = useCachedQuery(`stash:${character._id}`, liveStash);

	const wantsBag = view === "combat" || exitModal.isOpen;
	const zoneBag = useQuery(
		api.items.zoneBag,
		wantsBag && character.currentZoneSession
			? { zoneSession: character.currentZoneSession }
			: "skip",
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
	// Boss nodes use the warmup seconds as the calmaria budget so the time
	// bar fills during the warmup phase. No camps, no ambushes — the bar
	// just marks progress toward the gauntlet. Regular zones use their own
	// declared plan or the default.
	const encounterPlan = useMemo(() => {
		const warmup = currentNode?.bossNode?.warmupSeconds;
		if (warmup) {
			return {
				calmariaBudgetSeconds: warmup,
				gapBetweenSpawns: { min: 1.5, max: 3 },
				campFractions: [] as number[],
			};
		}
		return currentNode?.encounterPlan ?? DEFAULT_ENCOUNTER_PLAN;
	}, [currentNode?.bossNode?.warmupSeconds, currentNode?.encounterPlan]);

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
		initialBarrier: character.barrierCurrent ?? stats.maxBarrier,
		potions: character.potions ?? 0,
		incense: character.etherealIncense ?? 0,
		monsterPool,
		zoneLevel,
		encounterPlan,
		bossNode: currentNode?.bossNode ?? null,
		// Camp thresholds are server-rolled by enterZone; the time bar reads
		// them off the character query so the markers and the ticker stay
		// in lockstep with what enterCamp will accept. See
		// docs/plans/in-progress.md "Server-authoritative camp/phase
		// derivation".
		serverCampThresholdsMs: character.campThresholdsMs ?? EMPTY_THRESHOLDS,
		// Pause combat while the loot picker is open so the player can't die
		// mid-selection from a goblin they've already retreated from. Also
		// gated on the active-session token — the loop refuses to fire its
		// per-tick mutations until the server confirms this tab owns the
		// character.
		active: view === "combat" && !exitModal.isOpen && tokenMatches,
		onPlayerDeath: handlePlayerDeath,
	});

	// Bag retention cap by exit phase, frozen at modal-open time so
	// incremental picks don't dilute the 30% punishment ("bag shrinks each
	// pick → cap recomputes lower → effective share grows"). Reset when
	// the modal closes. Math lives in `computeBagKeepCap` so the client
	// preview can't drift from the server's enforcement.
	const [exitKeepCap, setExitKeepCap] = useState(0);

	// Spam-click guards. `useInFlight(view)` resets each flag on view change
	// so a slow request finishing after navigating away doesn't leave the
	// next visit's button stuck disabled. The enter-node and retreat flags
	// are discarded (no JSX disabled wiring — the in-handler early-return
	// inside `run…` is the full guard). Incense stays plain useState because
	// its trigger is synchronous; the watcher effect below clears it on the
	// optimistic count change instead.
	const [isUsingPotion, runUsePotion] = useInFlight(view);
	const [isUsingTeleportStone, runUseTeleportStone] = useInFlight(view);
	const runEnterNode = useInFlight(view)[1];
	const runRetreat = useInFlight(view)[1];
	const [isUsingIncense, setIsUsingIncense] = useState(false);

	const unlockedNodeIds = useMemo(
		() => new Set(character.unlockedNodes ?? ["city"]),
		[character.unlockedNodes],
	);
	const completedZoneIds = useMemo(
		() => new Set(character.completedZones ?? []),
		[character.completedZones],
	);

	const handleEnterNode = (nodeId: string) =>
		// `pendingArrival` catches subsequent clicks once set, but the click →
		// confirm → setPendingArrival flow leaves a small window where two
		// clicks could both fire startTravel. `runEnterNode` bails synchronously
		// on re-entry; the inner stone branch additionally hops onto
		// `runUseTeleportStone` so a map-click stone jump shares its flag with
		// the HUD's panic stone.
		runEnterNode(async () => {
			if (isTraveling) return;
			// Re-entering the current node skips travel — the player is already there.
			if (nodeId === currentLocation) {
				enterDestination(nodeId);
				return;
			}
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
				await runUseTeleportStone(async () => {
					setPendingArrival(nodeId);
					try {
						await teleportStone({
							characterId: character._id,
							destinationNodeId: nodeId,
						});
					} catch (err) {
						setPendingArrival(null);
						toast.error(convexErrorMessage(err, m.wind_crystal_failed()));
					}
				});
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
		});

	// Set while the exit modal is acting as the bag-handling step for a stone
	// jump. Cleared on cancel or after the stone fires.
	const pendingStoneRef = useRef(false);

	const fireStoneToCity = () =>
		runUseTeleportStone(async () => {
			setPendingArrival("city");
			try {
				await teleportStone({
					characterId: character._id,
					destinationNodeId: "city",
				});
			} catch (err) {
				setPendingArrival(null);
				toast.error(convexErrorMessage(err, m.teleport_stone_failed()));
			}
		});

	const handleUseTeleportStone = async () => {
		// Spam-click guard: the modal-open path doesn't go through
		// `runUseTeleportStone`, so an explicit `isUsingTeleportStone` check
		// here prevents a second click from re-opening the modal while a
		// fireStoneToCity from the previous click is still in flight.
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

	const handleRetreat = () =>
		// Wait for the bag query to resolve before deciding modal vs auto-exit —
		// otherwise an undefined (still-loading) bag silently discards the loot.
		// The flag covers both branches (modal-open + exitZone) so a fast double-
		// tap during the render-cycle window between click and unmount can't
		// double-open the modal or double-fire exitZone.
		runRetreat(async () => {
			if (zoneBag === undefined) return;
			if (zoneBag.length > 0) {
				// Bag path is modal-driven; the modal's own buttons carry their own
				// in-flight tracking. No async work here beyond opening the modal.
				handleBackToMap();
				setExitKeepCap(computeBagKeepCap(zoneBag.length, combat.phase));
				exitModal.open();
				return;
			}
			handleBackToMap();
			await exitZone({
				characterId: character._id,
				keepIds: [],
			});
		});

	const handlePickSelected = async (ids: Id<"items">[]) => {
		// Camp: incremental pick. Modal stays open until bag empties.
		// Non-camp: one-shot commit via exitZone — bag is wiped, modal closes.
		// Routing here matches the server gate (pickFromBag rejects non-camp).
		try {
			if (combat.phase === "camp") {
				await pickFromBag({
					characterId: character._id,
					itemIds: ids,
				});
			} else {
				await exitZone({
					characterId: character._id,
					keepIds: ids,
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
		await discardFromBag({
			characterId: character._id,
			itemIds: ids,
		});
	};

	const handlePickAll = async (ids: Id<"items">[]) => {
		try {
			await exitZone({
				characterId: character._id,
				keepIds: ids,
			});
			exitModal.close();
		} catch (err) {
			toast.error(convexErrorMessage(err, m.inventory_full_error()));
		}
	};

	const handleDiscardAll = async () => {
		await exitZone({
			characterId: character._id,
			keepIds: [],
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

	const handleSwitchElement = useCallback(
		async (element: "fire" | "cold" | "lightning") => {
			try {
				await switchElement({ characterId: character._id, element });
			} catch {
				// Cooldown or non-mage — silently swallowed
			}
		},
		[switchElement, character._id],
	);

	// Spam-click guard around `combat.usePotion`. The local `potions` count
	// already optimistically decrements, but a fast double-tap before the
	// optimistic update reaches React can fire `consumePotion` twice and the
	// second call gets rejected. `useInFlight` handles the early-return +
	// try/finally; the button-disabled state ANDs in `!isUsingPotion`.
	const handleUsePotion = () =>
		// `combat.usePotion` is the consumer-facing potion action returned
		// from `useCombatTick`. The `use` prefix is incidental — it's a
		// regular async function, not a React hook. See the same alias
		// rationale on `teleportStone` in useWorldMutations.ts.
		// biome-ignore lint/correctness/useHookAtTopLevel: not a React hook.
		runUsePotion(() => combat.usePotion());

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

	const [outOfCombatBarrier, setOutOfCombatBarrier] = useState<number | null>(
		null,
	);
	const outOfCombatBarrierRef = useRef(makeBarrierState(stats.maxBarrier));

	useEffect(() => {
		if (view === "combat") {
			setOutOfCombatBarrier(null);
			return;
		}
		const initial =
			view === "city"
				? stats.maxBarrier
				: (character.barrierCurrent ?? stats.maxBarrier);
		const state: ReturnType<typeof makeBarrierState> = {
			current: Math.min(initial, stats.maxBarrier),
			max: stats.maxBarrier,
			cooldownRemaining: 0,
		};
		outOfCombatBarrierRef.current = state;
		setOutOfCombatBarrier(state.current);
	}, [view, stats.maxBarrier]); // character.barrierCurrent excluded — one-time init per view switch

	const needsBarrierRegen =
		view !== "combat" &&
		outOfCombatBarrierRef.current.current < outOfCombatBarrierRef.current.max;

	useTicker(needsBarrierRegen, 500, () => {
		const next = tickBarrier(outOfCombatBarrierRef.current, 0.5);
		if (next !== outOfCombatBarrierRef.current) {
			outOfCombatBarrierRef.current = next;
			setOutOfCombatBarrier(next.current);
		}
	});

	// Persist regenerated barrier to DB when entering combat.
	const barrierSyncMutation = useSessionedMutation(
		useMutation(api.combat.syncHp),
	);
	useEffect(() => {
		if (view !== "combat") return;
		const regen = outOfCombatBarrierRef.current.current;
		const dbValue = character.barrierCurrent ?? stats.maxBarrier;
		if (regen > dbValue) {
			barrierSyncMutation({
				characterId: character._id,
				hpCurrent: character.hpCurrent ?? stats.maxLife,
				barrierCurrent: regen,
			}).catch(() => {});
		}
	}, [view]); // eslint-disable-line react-hooks/exhaustive-deps

	const barrierOverride =
		view === "combat"
			? combat.barrier.current
			: (outOfCombatBarrier ?? character.barrierCurrent ?? stats.maxBarrier);
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
		<main
			className={`relative grid h-screen overflow-hidden bg-black text-white ${compact ? "grid-cols-[1fr_520px] gap-2 p-2" : "grid-cols-[1fr_640px] gap-3 p-3"}`}
		>
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
			<div
				className={`grid overflow-hidden ${compact ? "grid-rows-[1fr_100px] gap-2" : "grid-rows-[1fr_160px] gap-3"}`}
			>
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
							onOpenLeaderboard={leaderboardModal.open}
						/>
						{travelOverlay}
					</div>
				)}
				{view === "city" && currentNode && (
					<CityScene
						cityName={translateNodeName(currentNode)}
						onLeave={handleBackToMap}
						onOpenVendor={vendorModal.open}
						onOpenStash={stashModal.open}
					/>
				)}
				{view === "combat" && currentNode && (
					<CombatScene
						zoneName={translateNodeName(currentNode)}
						zoneLevel={zoneLevel}
						state={combat.state}
						isBossNode={currentNode?.kind === "boss"}
						rareIntroStage={combat.rareIntroStage}
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
							combat.state !== "rare_intro" &&
							combat.state !== "boss_intro" &&
							combat.state !== "acampamento" &&
							combat.state !== "miniboss_victory" &&
							currentNode?.kind !== "boss" &&
							!(
								combat.state === "engaged" &&
								(combat.enemy?.rarity === "rare" ||
									combat.enemy?.rarity === "unique")
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
						classId={character.classId}
						selectedElement={character.selectedElement ?? "fire"}
						onSwitchElement={handleSwitchElement}
						lastElementSwitchAt={character.lastElementSwitchAt}
					/>
				)}
				<TextLog message={logMessage} tone={logTone} />
			</div>

			<aside
				className={`grid grid-rows-[1fr_auto] ${compact ? "gap-1" : "gap-3"}`}
			>
				<EquipmentPanel
					equippedBySlot={equippedBySlot}
					stats={stats}
					characterLevel={character.level}
					rubys={character.rubys ?? 0}
					onOpenInventory={inventoryModal.open}
				/>
				<StatusCard
					character={character}
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
				stashModal={stashModal}
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
				stashItems={stashItems ?? []}
				rubys={character.rubys ?? 0}
				potions={character.potions ?? 0}
				teleportStones={character.teleportStones ?? 0}
				onVendorBuy={async (productId) => {
					await vendorBuy({ characterId: character._id, productId });
				}}
				onVendorSellMany={async (itemIds) => {
					await vendorSellMany({ characterId: character._id, itemIds });
				}}
				onStashDeposit={async (itemIds) => {
					return await depositToStash({ characterId: character._id, itemIds });
				}}
				onStashWithdraw={async (itemIds) => {
					return await withdrawFromStash({
						characterId: character._id,
						itemIds,
					});
				}}
				onReorderInventory={({ itemId, targetSlot }) => {
					void reorderInventory({
						characterId: character._id,
						itemId,
						targetSlot,
					});
				}}
				onReorderStash={({ itemId, targetSlot }) => {
					void reorderStash({ characterId: character._id, itemId, targetSlot });
				}}
			/>
			<LeaderboardModal
				isOpen={leaderboardModal.isOpen}
				onClose={leaderboardModal.close}
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
			<SessionLostModal open={sessionLost} />
		</main>
	);
}
