import { noop, useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "#/components/ui/button";
import CityScene from "#/components/world/CityScene";
import { CombatPane } from "#/components/world/CombatPane";
import type { ConsumableKey } from "#/components/world/CombatScene";
import LeaderboardModal from "#/components/world/LeaderboardModal";
import SessionClaimFailedModal from "#/components/world/SessionClaimFailedModal";
import SessionLostModal from "#/components/world/SessionLostModal";
import ShowStatsModal from "#/components/world/ShowStatsModal";
import TextLog from "#/components/world/TextLog";
import { WorldMapPane } from "#/components/world/WorldMapPane";
import { WorldModals } from "#/components/world/WorldModals";
import {
	type EquippedBySlot,
	WorldSidebar,
} from "#/components/world/WorldSidebar";
import { defaultElementFor } from "#/game/classes/attunement";
import { findClassDefinition } from "#/game/classes/data";
import { stashModeOf } from "#/game/inventory/stash-mode";
import { computeCharacterStats } from "#/game/stats/compute";
import { type EquippedItem, type SelectableElement } from "#/game/stats/types";
import { ACT_1 } from "#/game/world";
import { translateNodeName } from "#/game/world/i18n";
import { resolveNodeClick } from "#/game/world/node-click";
import { resolveTextLog } from "#/game/world/text-log";
import { zoneContextFor } from "#/game/world/zone-context";
import { useBarrier } from "#/hooks/useBarrier";
import { useCachedQuery } from "#/hooks/useCachedQuery";
import { useCombatLoop } from "#/hooks/useCombatLoop";
import { useCombatMutations } from "#/hooks/useCombatMutations";
import { useCompactViewport } from "#/hooks/useCompactViewport";
import { useConfirmationModal } from "#/hooks/useConfirmationModal";
import { useExitFlow } from "#/hooks/useExitFlow";
import { useIncenseGuard } from "#/hooks/useIncenseGuard";
import { useInFlight } from "#/hooks/useInFlight";
import { useInventoryMutations } from "#/hooks/useInventoryMutations";
import { useModal } from "#/hooks/useModal";
import { useSessionClaim } from "#/hooks/useSessionClaim";
import { useSessionToken } from "#/hooks/useSessionToken";
import { useViewMode } from "#/hooks/useViewMode";
import { useWorldMutations } from "#/hooks/useWorldMutations";
import { useTRPC } from "#/integrations/trpc/client";
import type { CharacterRow } from "#/lib/api-types";
import { requireSession } from "#/lib/require-session";
import { serverErrorMessage } from "#/lib/server-error-message";
import { useWorldCache } from "#/lib/world-cache";
import { m } from "#/paraglide/messages";

// Coerced: a pasted or bookmarked URL carries the id as text.
const searchSchema = z.object({
	characterId: z.coerce.number().int().positive(),
});

export const Route = createFileRoute("/world")({
	validateSearch: searchSchema,
	beforeLoad: async ({ context }) => {
		await requireSession(context);
	},
	loaderDeps: ({ search }) => ({ characterId: search.characterId }),
	// The three reads the layout needs go out together: one batched request
	// in the browser, in-process (and dehydrated into the page) during SSR.
	loader: async ({ context, deps: { characterId } }) => {
		const { queryClient, trpc } = context;
		// A failed prefetch is not a route error: the component's own query
		// retries and shows its error state.
		await Promise.all([
			queryClient
				.query(trpc.characters.byId.queryOptions({ id: characterId }))
				.catch(noop),
			queryClient
				.query(trpc.items.equipped.queryOptions({ characterId }))
				.catch(noop),
			queryClient
				.query(trpc.items.inventory.queryOptions({ characterId }))
				.catch(noop),
		]);
	},
	component: WorldView,
});

function WorldView() {
	const { characterId } = Route.useSearch();
	const navigate = useNavigate();
	const trpc = useTRPC();
	// An unknown id (or another account's) resolves to `null` → redirect below.
	// The only query refetched on window focus: it is how a session taken over
	// by another tab shows up without a failed write first.
	const { data: character } = useQuery({
		...trpc.characters.byId.queryOptions({ id: characterId }),
		refetchOnWindowFocus: true,
	});

	const missing = character === null;

	useEffect(() => {
		if (missing) void navigate({ to: "/character-select" });
	}, [missing, navigate]);

	if (!character) {
		return (
			<main className="flex h-screen items-center justify-center bg-black text-white">
				<p className="text-xs uppercase tracking-label text-muted-foreground">
					{m.loading()}
				</p>
			</main>
		);
	}

	return <WorldLayout character={character} />;
}

// Stable identity for the "no thresholds yet" case (no zone visit yet). A
// fresh `?? []` would allocate a new reference per render, retriggering the
// downstream ref-sync useEffect in useEncounterSchedule for no reason.
const EMPTY_THRESHOLDS: readonly number[] = [];

// The /world grid at each viewport size: the scene column next to the fixed
// sidebar, and inside it the scene above the text log.
const LAYOUT = {
	compact: {
		main: "grid-cols-world-compact gap-2 p-2",
		scene: "grid-rows-world-scene-compact gap-2",
	},
	wide: {
		main: "grid-cols-world gap-3 p-3",
		scene: "grid-rows-world-scene gap-3",
	},
};

// Sections, in order: composition (every hook) → handlers → derivations →
// JSX. Logic with a decision in it lives in `src/game` or a tested hook; this
// component wires them. See docs/plans/in-progress.md → world.tsx size.
function WorldLayout({ character }: { character: CharacterRow }) {
	const navigate = useNavigate();
	const confirm = useConfirmationModal();
	const compact = useCompactViewport();
	const trpc = useTRPC();
	const cache = useWorldCache(character.id);
	const classDef = findClassDefinition(character.classId);
	const { sessionToken } = useSessionToken();
	// Gate the combat loop on the active-session check — a stale tab whose
	// claim was stolen by another tab/device shouldn't keep firing recordKill
	// / syncHp into rejection. The combat HUD freezes silently here; the
	// next user-initiated mutation surfaces the "Session lost" modal via the
	// global error handler. See docs/security/threat-model.md → Threat #5.
	const tokenMatches = character.activeSessionToken === sessionToken;
	const { mutateAsync: claimSession } = useMutation(
		trpc.characters.claimCharacterSession.mutationOptions({
			onSuccess: ({ sessionToken: claimed }) =>
				cache.patchCharacter({ activeSessionToken: claimed }),
		}),
	);
	const { sessionLost, claimFailure, retryClaim } = useSessionClaim({
		tokenMatches,
		characterId: character.id,
		sessionToken,
		claim: claimSession,
	});

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
	// Memoized on the location so the schedule's plan-bound callbacks
	// (recordSpawn, cancelAmbush) stay stable: a boss node's plan is built
	// fresh on each call.
	const zone = useMemo(
		() => zoneContextFor(ACT_1, currentLocation),
		[currentLocation],
	);
	const currentNode = zone.node;
	const zoneLevel = zone.level ?? character.level;

	// Equipped is always-on because stats (maxLife, damage, etc.) depend on it
	// for the combat loop.
	const { data: liveEquipped } = useQuery(
		trpc.items.equipped.queryOptions({ characterId: character.id }),
	);
	const equippedItems = useCachedQuery(
		`equipped:${character.id}`,
		liveEquipped,
	);

	// Prefer the live query over the localStorage copy so the snapshot
	// recomputes the instant the cache holds a new equipped list — the
	// localStorage layer is only the cold-start fallback.
	const equippedSnapshot: EquippedItem[] = useMemo(() => {
		const source = liveEquipped ?? equippedItems ?? [];
		const out: EquippedItem[] = [];
		for (const item of source) {
			if (item.equippedSlot) {
				out.push({ slot: item.equippedSlot, item: item.data });
			}
		}
		return out;
	}, [liveEquipped, equippedItems]);

	const selectedElement =
		character.selectedElement ?? defaultElementFor(character.classId);
	const stats = useMemo(
		() =>
			computeCharacterStats({
				classDef,
				level: character.level,
				equippedItems: equippedSnapshot,
				selectedElement: selectedElement ?? undefined,
			}),
		[classDef, character.level, equippedSnapshot, selectedElement],
	);

	const barrierApi = useBarrier({
		maxBarrier: stats.maxBarrier,
		initialBarrier: character.barrierCurrent,
		active: true,
	});

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
		depositToStash,
		withdrawFromStash,
		reorderStash,
	} = useWorldMutations({
		characterId: character.id,
		movementSpeed: stats.movementSpeed,
	});
	const inventoryServer = useInventoryMutations(character.id);
	const { reorderInventory } = inventoryServer;

	const { view, setView, setPendingArrival, isTraveling, enterDestination } =
		useViewMode({
			characterId: character.id,
			travelDestination: character.travelDestination,
			travelArrivesAt: character.travelArrivesAt,
			enterCity,
			enterZone,
			arriveAtTravel,
			onEnterNewArea: (nodeId) => {
				setDeathLog(null);
				// A new zone visit starts clean. `combat` is declared below (it
				// needs `view`); this runs on the entry event, after render.
				const entered = zoneContextFor(ACT_1, nodeId);
				combat.startVisit(entered.encounterPlan, entered.bossNode);
			},
		});

	// Always loaded: the optimistic equip / unequip / discard updates need a
	// cached baseline, and the mutations keep it current (no refetch).
	const { data: liveInventory } = useQuery(
		trpc.items.inventory.queryOptions({ characterId: character.id }),
	);
	const inventoryItems = useCachedQuery(
		`inventory:${character.id}`,
		liveInventory,
	);

	// Stash: fetched the first time the modal opens (~60 items × 1KB), then
	// kept current by the stash mutations; useCachedQuery covers the cold-open.
	const { data: liveStash } = useQuery({
		...trpc.items.stash.queryOptions({ stashMode: stashModeOf(character) }),
		enabled: stashModal.isOpen,
	});
	const stashItems = useCachedQuery(`stash:${character.id}`, liveStash);

	// The bag only matters inside a zone visit; enterZone / exitZone and the
	// kills keep the cached copy current.
	const { data: zoneBag } = useQuery({
		...trpc.items.zoneBag.queryOptions({ characterId: character.id }),
		enabled:
			(view === "combat" || exitModal.isOpen) &&
			character.currentZoneSession !== null,
	});
	const bagSize = zoneBag?.length;

	const equippedBySlot: EquippedBySlot = useMemo(
		() =>
			new Map(
				equippedSnapshot.map((eq) => [
					eq.slot,
					{ id: eq.item.id, data: eq.item },
				]),
			),
		[equippedSnapshot],
	);
	const unlockedNodeIds = useMemo(
		() => new Set(character.unlockedNodes),
		[character.unlockedNodes],
	);
	const completedZoneIds = useMemo(
		() => new Set(character.completedZones),
		[character.completedZones],
	);

	const combatServer = useCombatMutations({
		characterId: character.id,
		maxHp: stats.maxLife,
	});
	const combat = useCombatLoop({
		characterId: character.id,
		server: combatServer,
		stats,
		initialHp: character.hpCurrent,
		barrierApi,
		potions: character.potions,
		incense: character.etherealIncense,
		monsterPool: zone.monsterPool,
		zoneLevel,
		encounterPlan: zone.encounterPlan,
		bossNode: zone.bossNode,
		serverCampThresholdsMs: character.campThresholdsMs ?? EMPTY_THRESHOLDS,
		active: view === "combat" && !exitModal.isOpen && tokenMatches,
		// The tick fires this and moves on; `handlePlayerDeath` catches its own
		// errors (toast), so nothing is left to await. It is declared with the
		// handlers below and only called after render.
		onPlayerDeath: () => void handlePlayerDeath(),
	});

	// Spam-click guards. `useInFlight(view)` resets each flag on view change
	// so a slow request finishing after navigating away doesn't leave the
	// next visit's button stuck disabled. The enter-node flag is discarded
	// (no JSX disabled wiring — the in-handler early-return inside `run…` is
	// the full guard). The stone and retreat flags live in `useExitFlow`.
	const [isUsingPotion, runUsePotion] = useInFlight(view);
	const runEnterNode = useInFlight(view)[1];
	const { isUsingIncense, lightIncense } = useIncenseGuard(
		combat.incense,
		combat.triggerIncense,
	);
	const exitFlow = useExitFlow({
		characterId: character.id,
		view,
		bagSize,
		phase: combat.phase,
		teleportStones: character.teleportStones,
		exitModal,
		server: { exitZone, pickFromBag, discardFromBag, teleportStone },
		backToMap: () => setView("map"),
		setPendingArrival,
	});

	// City entry restores barrier to full (ADR 0005). Destructure
	// restoreToFull so the dep is the memoized callback, not the freshly-
	// constructed barrierApi object (which would re-fire every render).
	const { restoreToFull: restoreBarrierToFull } = barrierApi;
	useEffect(() => {
		if (view === "city") restoreBarrierToFull();
	}, [view, restoreBarrierToFull]);

	const handlePlayerDeath = async () => {
		try {
			const result = await respawnDead({ characterId: character.id });
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
	};

	const handleEnterNode = (nodeId: string) =>
		// `pendingArrival` catches subsequent clicks once set, but the click →
		// confirm → setPendingArrival flow leaves a small window where two
		// clicks could both fire startTravel. `runEnterNode` bails synchronously
		// on re-entry; the stone branch additionally hops onto the exit flow's
		// `runUseTeleportStone` so a map-click stone jump shares its flag with
		// the HUD's panic stone.
		runEnterNode(async () => {
			if (isTraveling) return;
			const click = resolveNodeClick({
				act: ACT_1,
				nodeId,
				currentLocation,
				unlockedNodeIds,
				teleportStones: character.teleportStones,
			});
			if (click.kind === "reenter") {
				enterDestination(nodeId);
				return;
			}
			if (click.kind === "no-route") {
				toast.error(m.travel_no_route({ destination: click.destinationName }));
				return;
			}
			if (click.kind === "stone") {
				const ok = await confirm({
					title: m.wind_crystal_confirm_title(),
					message: m.wind_crystal_confirm_message({
						destination: click.destinationName,
						remaining: click.stones,
					}),
					confirmLabel: m.wind_crystal_use_action(),
					cancelLabel: m.cancel(),
				});
				if (!ok) return;
				await exitFlow.runUseTeleportStone(async () => {
					setPendingArrival(nodeId);
					try {
						await teleportStone({
							characterId: character.id,
							destinationNodeId: nodeId,
						});
					} catch (err) {
						setPendingArrival(null);
						toast.error(serverErrorMessage(err, m.wind_crystal_failed()));
					}
				});
				return;
			}
			setPendingArrival(nodeId);
			try {
				await startTravel({
					characterId: character.id,
					destinationNodeId: nodeId,
				});
			} catch {
				setPendingArrival(null);
			}
		});

	const handleBackToMap = () => {
		setView("map");
	};

	const handleSwitchElement = async (element: SelectableElement) => {
		try {
			await switchElement({ characterId: character.id, element });
		} catch {
			// Cooldown or non-mage — silently swallowed
		}
	};

	// Spam-click guard around `combat.drinkPotion`. The local `potions` count
	// already optimistically decrements, but a fast double-tap before the
	// optimistic update reaches React can fire `consumePotion` twice and the
	// second call gets rejected. `useInFlight` handles the early-return +
	// try/finally; the buttons' disabled state ANDs in `!isUsingPotion`.
	const handleUsePotion = () => runUsePotion(() => combat.drinkPotion());

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

	const textLog = resolveTextLog({
		act: ACT_1,
		view,
		deathLog,
		consumableHover,
		playerHp: combat.playerHp,
		maxHp: stats.maxLife,
		potions: combat.potions,
		hoveredNodeId,
		currentNode,
	});
	const layout = compact ? LAYOUT.compact : LAYOUT.wide;

	return (
		<main
			className={`relative grid h-screen overflow-hidden bg-black text-white ${layout.main}`}
		>
			{view === "map" && (
				<Button
					variant="hud"
					size="hud"
					caps
					onClick={handleLeaveWorld}
					aria-label={m.leave_world_back_label()}
					className="absolute top-5 left-5 z-20"
				>
					<ArrowLeft className="size-3.5" strokeWidth={2} />
					{m.back()}
				</Button>
			)}
			<div className={`grid overflow-hidden ${layout.scene}`}>
				{view === "map" && (
					<WorldMapPane
						currentNode={currentNode}
						currentLocation={currentLocation}
						hoveredNodeId={hoveredNodeId}
						onHoverNode={setHoveredNodeId}
						onEnterNode={handleEnterNode}
						unlockedNodeIds={unlockedNodeIds}
						completedZoneIds={completedZoneIds}
						teleportStones={character.teleportStones}
						onOpenSettings={settingsModal.open}
						onOpenLeaderboard={leaderboardModal.open}
						isTraveling={isTraveling}
						travelDestination={character.travelDestination}
						travelArrivesAt={character.travelArrivesAt}
					/>
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
					<CombatPane
						node={currentNode}
						zoneLevel={zoneLevel}
						combat={combat}
						maxHp={stats.maxLife}
						barrier={barrierApi.barrier}
						character={character}
						selectedElement={selectedElement}
						bagSize={bagSize}
						isUsingPotion={isUsingPotion}
						isUsingTeleportStone={exitFlow.isUsingTeleportStone}
						isUsingIncense={isUsingIncense}
						onUsePotion={handleUsePotion}
						onUseTeleportStone={exitFlow.stoneToCity}
						onUseIncense={lightIncense}
						onRetreat={exitFlow.retreat}
						onOpenBag={bagModal.open}
						onConsumableHover={setConsumableHover}
						onSwitchElement={handleSwitchElement}
					/>
				)}
				<TextLog message={textLog.message} tone={textLog.tone} />
			</div>

			<WorldSidebar
				compact={compact}
				view={view}
				character={character}
				stats={stats}
				equippedBySlot={equippedBySlot}
				barrier={barrierApi.barrier}
				combatHp={combat.playerHp}
				combatPotions={combat.potions}
				isUsingPotion={isUsingPotion}
				isUsingTeleportStone={exitFlow.isUsingTeleportStone}
				onUsePotion={handleUsePotion}
				onUseTeleportStone={exitFlow.stoneToCity}
				onOpenInventory={inventoryModal.open}
				onShowStats={statsModal.open}
			/>

			<WorldModals
				bagModal={bagModal}
				exitModal={exitModal}
				inventoryModal={inventoryModal}
				vendorModal={vendorModal}
				stashModal={stashModal}
				settingsModal={settingsModal}
				zoneBag={zoneBag}
				exitKeepCap={exitFlow.exitKeepCap}
				onExitClose={exitFlow.dismissExit}
				onPickSelected={exitFlow.pickSelected}
				onDiscardSelected={exitFlow.discardSelected}
				onPickAll={exitFlow.pickAll}
				onDiscardAll={exitFlow.discardAll}
				stats={stats}
				characterId={character.id}
				characterLevel={character.level}
				equippedItems={equippedItems}
				inventoryItems={inventoryItems}
				stashItems={stashItems}
				rubys={character.rubys}
				potions={character.potions}
				teleportStones={character.teleportStones}
				onVendorBuy={async (productId, quantity) => {
					await vendorBuy({ characterId: character.id, productId, quantity });
				}}
				onVendorSellMany={async (itemIds) => {
					await vendorSellMany({ characterId: character.id, itemIds });
				}}
				onStashDeposit={async (itemIds) => {
					return depositToStash({ characterId: character.id, itemIds });
				}}
				onStashWithdraw={async (itemIds) => {
					return withdrawFromStash({
						characterId: character.id,
						itemIds,
					});
				}}
				onReorderInventory={({ itemId, targetSlot, swapWithItemId }) => {
					void reorderInventory({
						characterId: character.id,
						itemId,
						targetSlot,
						swapWithItemId,
					});
				}}
				onReorderStash={({ itemId, targetSlot, swapWithItemId }) => {
					void reorderStash({
						characterId: character.id,
						itemId,
						targetSlot,
						swapWithItemId,
					});
				}}
				inventoryServer={inventoryServer}
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
					currentBarrier={barrierApi.barrier.current}
					currentLife={combat.playerHp}
				/>
			)}
			<SessionLostModal open={sessionLost} />
			<SessionClaimFailedModal failure={claimFailure} onRetry={retryClaim} />
		</main>
	);
}
