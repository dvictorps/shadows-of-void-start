import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import type { OptimisticLocalStore } from "convex/browser";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import BagPreviewModal from "#/components/world/BagPreviewModal";
import CityScene from "#/components/world/CityScene";
import CombatScene, {
	type ConsumableKey,
} from "#/components/world/CombatScene";
import EquipmentPanel from "#/components/world/EquipmentPanel";
import ExitZoneModal from "#/components/world/ExitZoneModal";
import InventoryModal from "#/components/world/InventoryModal";
import MapScene from "#/components/world/MapScene";
import SettingsModal from "#/components/world/SettingsModal";
import ShowStatsModal from "#/components/world/ShowStatsModal";
import StatusCard from "#/components/world/StatusCard";
import TextLog from "#/components/world/TextLog";
import TravelProgressBar from "#/components/world/TravelProgressBar";
import VendorModal from "#/components/world/VendorModal";
import { findClassDefinition } from "#/game/classes/data";
import { teleportStoneTravelSeconds } from "#/game/combat/constants";
import { bySlotAsc, INVENTORY_MAX_SLOTS } from "#/game/inventory/constants";
import { computeSellPrice } from "#/game/items/sell-price";
import { xpToNextLevel } from "#/game/progression/levels";
import { computeCharacterStats } from "#/game/stats/compute";
import {
	type EquippedItem,
	type EquippedSlot,
	narrowEquippedSlot,
} from "#/game/stats/types";
import { VENDOR_PRODUCTS, type VendorProductId } from "#/game/vendor/products";
import { ACT_1, findNode } from "#/game/world";
import { translateNodeDescription, translateNodeName } from "#/game/world/i18n";
import { DEFAULT_ENCOUNTER_PLAN } from "#/game/world/encounter-schedule";
import { computeTravelTime } from "#/game/world/travel";
import { useCachedQuery } from "#/hooks/useCachedQuery";
import { useCombatLoop } from "#/hooks/useCombatLoop";
import { useConfirmationModal } from "#/hooks/useConfirmationModal";
import { useModal } from "#/hooks/useModal";
import { m } from "#/paraglide/messages";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";

const searchSchema = z.object({
	characterId: z.string(),
});

const CONSUMABLE_DESCRIPTIONS: Record<ConsumableKey, () => string> = {
	potion: m.consumable_desc_potion,
	teleport: m.consumable_desc_teleport,
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

type ViewMode = "map" | "city" | "combat";

// Helpers for the optimistic-update closures below. `findCharacter` reads the
// current `api.characters.list` cache and locates the active character;
// `applyCharacterDelta` writes a shallow patch on top of that character.
// Both are no-ops when the query hasn't resolved yet — same defensive shape
// every Convex optimistic closure uses.
function findCharacter(
	localStore: OptimisticLocalStore,
	characterId: Id<"characters">,
): Doc<"characters"> | undefined {
	const characters = localStore.getQuery(api.characters.list, {});
	return characters?.find((c) => c._id === characterId);
}

function applyCharacterDelta(
	localStore: OptimisticLocalStore,
	characterId: Id<"characters">,
	delta: Partial<Doc<"characters">>,
): void {
	const characters = localStore.getQuery(api.characters.list, {});
	if (!characters) return;
	localStore.setQuery(
		api.characters.list,
		{},
		characters.map((c) => (c._id === characterId ? { ...c, ...delta } : c)),
	);
}

function WorldLayout({ character }: { character: Doc<"characters"> }) {
	const navigate = useNavigate();
	const confirm = useConfirmationModal();
	const classDef = findClassDefinition(character.classId);
	const enterCity = useMutation(api.combat.enterCity);
	const enterZone = useMutation(api.combat.enterZone);
	const exitZone = useMutation(api.items.exitZone).withOptimisticUpdate(
		(localStore, args) => {
			// On commit, the bag goes to zero and `keepIds` items become inventory
			// docs. Mirror that locally so the modal can auto-close immediately.
			const bagKey = { characterId: args.characterId };
			const bag = localStore.getQuery(api.items.zoneBag, bagKey);
			if (bag) localStore.setQuery(api.items.zoneBag, bagKey, []);
			const keep = new Set(args.keepIds.map((id) => id.toString()));
			const keptDocs = (bag ?? []).filter((it) => keep.has(it._id.toString()));
			if (keptDocs.length === 0) return;
			const inv = localStore.getQuery(api.items.inventory, bagKey) ?? [];
			const occupied = new Set<number>();
			for (const it of inv) {
				if (typeof it.inventorySlot === "number")
					occupied.add(it.inventorySlot);
			}
			let cursor = 0;
			const nextFreeSlot = (): number => {
				while (cursor < INVENTORY_MAX_SLOTS && occupied.has(cursor)) cursor++;
				if (cursor >= INVENTORY_MAX_SLOTS) return -1;
				const s = cursor++;
				occupied.add(s);
				return s;
			};
			const moved = keptDocs.map((d) => ({
				...d,
				locationKind: "inventory" as const,
				zoneSession: undefined,
				inventorySlot: nextFreeSlot(),
			}));
			localStore.setQuery(
				api.items.inventory,
				bagKey,
				[...inv, ...moved].sort(bySlotAsc),
			);
		},
	);
	const pickFromBag = useMutation(api.items.pickFromBag).withOptimisticUpdate(
		(localStore, args) => {
			const bagKey = { characterId: args.characterId };
			const bag = localStore.getQuery(api.items.zoneBag, bagKey);
			if (!bag) return;
			const idSet = new Set(args.itemIds.map((id) => id.toString()));
			const picked = bag.filter((it) => idSet.has(it._id.toString()));
			if (picked.length === 0) return;
			const remaining = bag.filter((it) => !idSet.has(it._id.toString()));
			localStore.setQuery(api.items.zoneBag, bagKey, remaining);
			const inv = localStore.getQuery(api.items.inventory, bagKey) ?? [];
			const occupied = new Set<number>();
			for (const it of inv) {
				if (typeof it.inventorySlot === "number")
					occupied.add(it.inventorySlot);
			}
			let cursor = 0;
			const nextFreeSlot = (): number => {
				while (cursor < INVENTORY_MAX_SLOTS && occupied.has(cursor)) cursor++;
				if (cursor >= INVENTORY_MAX_SLOTS) return -1;
				const s = cursor++;
				occupied.add(s);
				return s;
			};
			const moved = picked.map((d) => ({
				...d,
				locationKind: "inventory" as const,
				zoneSession: undefined,
				inventorySlot: nextFreeSlot(),
			}));
			localStore.setQuery(
				api.items.inventory,
				bagKey,
				[...inv, ...moved].sort(bySlotAsc),
			);
		},
	);
	const discardFromBag = useMutation(
		api.items.discardFromBag,
	).withOptimisticUpdate((localStore, args) => {
		const bagKey = { characterId: args.characterId };
		const bag = localStore.getQuery(api.items.zoneBag, bagKey);
		if (!bag) return;
		const idSet = new Set(args.itemIds.map((id) => id.toString()));
		localStore.setQuery(
			api.items.zoneBag,
			bagKey,
			bag.filter((it) => !idSet.has(it._id.toString())),
		);
	});
	const respawnDead = useMutation(api.combat.respawnDead);
	// Optimistic startTravel — paint the travel state on the client before the
	// mutation round-trips so the progress bar shows instantly. The server's
	// authoritative values overwrite the prediction when the response arrives
	// (~100-200ms later, invisible). Reads movementSpeed from a ref because
	// `stats` isn't in scope at this point in the function body; the ref is
	// assigned further down, before any user click can fire.
	const movementSpeedRef = useRef(0);
	const startTravel = useMutation(api.combat.startTravel).withOptimisticUpdate(
		(localStore, args) => {
			const char = findCharacter(localStore, args.characterId);
			if (!char) return;
			const fromId = char.currentLocation ?? "city";
			const fromNode = findNode(ACT_1, fromId);
			const conn = fromNode?.connections.find(
				(c) => c.id === args.destinationNodeId,
			);
			if (!conn) return;
			const seconds = computeTravelTime(
				conn.distance,
				movementSpeedRef.current,
			);
			const startedAt = Date.now();
			const arrivesAt = startedAt + Math.round(seconds * 1000);
			applyCharacterDelta(localStore, args.characterId, {
				travelDestination: args.destinationNodeId,
				travelStartedAt: startedAt,
				travelArrivesAt: arrivesAt,
			});
		},
	);
	const arriveAtTravel = useMutation(api.combat.arriveAtTravel);
	// Vendor mutations with optimistic updates so fast/repeat clicks don't
	// outrun the reactive query and trigger "cap reached" / "item not found"
	// errors from a stale client view.
	const vendorBuy = useMutation(api.vendor.vendorBuy).withOptimisticUpdate(
		(localStore, args) => {
			const char = findCharacter(localStore, args.characterId);
			if (!char) return;
			const product = VENDOR_PRODUCTS[args.productId as VendorProductId];
			if (!product) return;
			const rubys = char.rubys ?? 0;
			if (rubys < product.priceRubys) return;
			const currentCount = char[product.counterField] ?? 0;
			if (product.cap !== undefined && currentCount >= product.cap) return;
			applyCharacterDelta(localStore, args.characterId, {
				rubys: rubys - product.priceRubys,
				[product.counterField]: currentCount + 1,
			});
		},
	);
	const useTeleportStone = useMutation(
		api.combat.useTeleportStone,
	).withOptimisticUpdate((localStore, args) => {
		const char = findCharacter(localStore, args.characterId);
		if (!char) return;
		const stones = char.teleportStones ?? 0;
		if (stones <= 0) return;
		const destinationNodeId = args.destinationNodeId ?? "city";
		const startedAt = Date.now();
		const arrivesAt =
			startedAt + teleportStoneTravelSeconds(destinationNodeId) * 1000;
		applyCharacterDelta(localStore, args.characterId, {
			teleportStones: stones - 1,
			currentZoneSession: undefined,
			travelDestination: destinationNodeId,
			travelStartedAt: startedAt,
			travelArrivesAt: arrivesAt,
		});
	});
	const vendorSellMany = useMutation(
		api.vendor.vendorSellMany,
	).withOptimisticUpdate((localStore, args) => {
		const inventory = localStore.getQuery(api.items.inventory, {
			characterId: args.characterId,
		});
		if (!inventory) return;
		const idSet = new Set(args.itemIds.map((id) => id.toString()));
		const sold = inventory.filter((it) => idSet.has(it._id.toString()));
		if (sold.length === 0) return;
		const total = sold.reduce((sum, it) => sum + computeSellPrice(it.data), 0);
		localStore.setQuery(
			api.items.inventory,
			{ characterId: args.characterId },
			inventory.filter((it) => !idSet.has(it._id.toString())),
		);
		const characters = localStore.getQuery(api.characters.list, {});
		if (!characters) return;
		localStore.setQuery(
			api.characters.list,
			{},
			characters.map((c) =>
				c._id === args.characterId
					? { ...c, rubys: (c.rubys ?? 0) + total }
					: c,
			),
		);
	});

	const [view, setView] = useState<ViewMode>("map");
	const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
	const [deathLog, setDeathLog] = useState<string | null>(null);
	const [consumableHover, setConsumableHover] = useState<ConsumableKey | null>(
		null,
	);
	// Set when the player clicks a node that requires travel — the auto-arrival
	// effect transitions the view to this node's area when travel completes.
	// Also reseeded from `travelDestination` on mount so a refresh mid-travel
	// still arrives in the right view.
	const [pendingArrival, setPendingArrival] = useState<string | null>(null);
	const bagModal = useModal();
	const exitModal = useModal();
	const inventoryModal = useModal();
	const settingsModal = useModal();
	const statsModal = useModal();
	const vendorModal = useModal();
	const wantsBag = view === "combat" || exitModal.isOpen;
	const zoneBag = useQuery(
		api.items.zoneBag,
		wantsBag ? { characterId: character._id } : "skip",
	);
	const currentLocation = character.currentLocation ?? "city";
	const currentNode = findNode(ACT_1, currentLocation);
	const hoveredNode = hoveredNodeId ? findNode(ACT_1, hoveredNodeId) : null;
	const travelDestination = character.travelDestination;
	const travelArrivesAt = character.travelArrivesAt;
	const isTraveling =
		travelDestination !== undefined && travelArrivesAt !== undefined;

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
	// Latest movement speed for the startTravel optimistic update (defined above
	// before stats are computed). Reading from ref keeps the closure stable.
	movementSpeedRef.current = stats.movementSpeed;
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
	const encounterPlan =
		currentNode?.encounterPlan ?? DEFAULT_ENCOUNTER_PLAN;

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
	}, [respawnDead, character._id]);

	const combat = useCombatLoop({
		characterId: character._id,
		stats,
		initialHp: character.hpCurrent ?? maxHp,
		initialPotions: character.potions ?? 0,
		monsterPool,
		zoneLevel,
		encounterPlan,
		// Pause combat while the loot picker is open so the player can't die
		// mid-selection from a goblin they've already retreated from.
		active: view === "combat" && !exitModal.isOpen,
		onPlayerDeath: handlePlayerDeath,
	});

	// Bag retention cap by exit phase. Camp keeps the full bag (player picks
	// freely); exploração / combate cap at 30% (min 1) — the "punished but
	// not zeroed" tier. See CONTEXT.md → Bag retention tiers.
	const exitKeepCap = useMemo(() => {
		const bagSize = zoneBag?.length ?? 0;
		if (bagSize === 0) return 0;
		if (combat.phase === "acampamento") return bagSize;
		return Math.max(1, Math.floor(bagSize * 0.3));
	}, [zoneBag, combat.phase]);

	// Enter a node's area directly (no travel). Caller has already verified
	// the player is "at" the node either by arrival or by clicking the
	// already-current node.
	const enterDestination = useCallback(
		(nodeId: string) => {
			const node = findNode(ACT_1, nodeId);
			if (!node) return;
			setDeathLog(null);
			if (node.kind === "city") {
				setView("city");
				void enterCity({ characterId: character._id });
			} else if (node.kind === "combat" || node.kind === "boss") {
				setView("combat");
				void enterZone({ characterId: character._id, zoneId: nodeId });
			}
		},
		[character._id, enterCity, enterZone],
	);

	// Refresh resilience: if we land on this view mid-travel (no client-side
	// pendingArrival yet), seed it from the server so the auto-arrival effect
	// triggers the correct view transition when the timer fires.
	useEffect(() => {
		if (travelDestination && !pendingArrival) {
			setPendingArrival(travelDestination);
		}
	}, [travelDestination, pendingArrival]);

	// Auto-arrival: schedule arriveAtTravel at travelArrivesAt. If we're already
	// past the arrival time (long-tab-closed case), fire immediately.
	useEffect(() => {
		if (!isTraveling || travelArrivesAt === undefined) return;
		const remaining = travelArrivesAt - Date.now();
		if (remaining <= 0) {
			void arriveAtTravel({ characterId: character._id });
			return;
		}
		const timer = window.setTimeout(() => {
			void arriveAtTravel({ characterId: character._id });
		}, remaining);
		return () => window.clearTimeout(timer);
	}, [isTraveling, travelArrivesAt, arriveAtTravel, character._id]);

	// Auto-enter destination after the server confirms arrival. Detects the
	// transition "was traveling → not traveling AND now at the pendingArrival".
	useEffect(() => {
		if (!pendingArrival || isTraveling) return;
		if (currentLocation !== pendingArrival) return;
		enterDestination(pendingArrival);
		setPendingArrival(null);
	}, [pendingArrival, isTraveling, currentLocation, enterDestination]);

	const unlockedNodeIds = useMemo(
		() => new Set(character.unlockedNodes ?? ["city"]),
		[character.unlockedNodes],
	);
	const completedZoneIds = useMemo(
		() => new Set(character.completedZones ?? []),
		[character.completedZones],
	);

	const handleEnterNode = async (nodeId: string) => {
		if (isTraveling) return;
		// Re-entering the current node skips travel — the player is already there.
		if (nodeId === currentLocation) {
			enterDestination(nodeId);
			return;
		}
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
			setPendingArrival(nodeId);
			try {
				await useTeleportStone({
					characterId: character._id,
					destinationNodeId: nodeId,
				});
			} catch (err) {
				setPendingArrival(null);
				toast.error(
					err instanceof Error ? err.message : m.wind_crystal_failed(),
				);
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
	};

	// Set while the exit modal is acting as the bag-handling step for a stone
	// jump. Cleared on cancel or after the stone fires.
	const pendingStoneRef = useRef(false);

	const fireStoneToCity = async () => {
		setPendingArrival("city");
		try {
			await useTeleportStone({
				characterId: character._id,
				destinationNodeId: "city",
			});
		} catch (err) {
			setPendingArrival(null);
			toast.error(
				err instanceof Error ? err.message : m.teleport_stone_failed(),
			);
		}
	};

	const handleUseTeleportStone = async () => {
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
			exitModal.open();
			return;
		}
		await fireStoneToCity();
	};

	const handleBackToMap = () => {
		setView("map");
	};

	const handleRetreat = () => {
		// Wait for the bag query to resolve before deciding modal vs auto-exit —
		// otherwise an undefined (still-loading) bag silently discards the loot.
		if (zoneBag === undefined) return;
		handleBackToMap();
		if (zoneBag.length > 0) {
			exitModal.open();
		} else {
			void exitZone({ characterId: character._id, keepIds: [] });
		}
	};

	const handlePickSelected = async (ids: Id<"items">[]) => {
		try {
			await pickFromBag({ characterId: character._id, itemIds: ids });
		} catch {
			toast.error(m.inventory_full_error());
		}
	};

	const handleDiscardSelected = async (ids: Id<"items">[]) => {
		await discardFromBag({ characterId: character._id, itemIds: ids });
	};

	const handlePickAll = async (ids: Id<"items">[]) => {
		try {
			await exitZone({ characterId: character._id, keepIds: ids });
			exitModal.close();
		} catch {
			toast.error(m.inventory_full_error());
		}
	};

	const handleDiscardAll = async () => {
		await exitZone({ characterId: character._id, keepIds: [] });
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
	const onUsePotion =
		view === "combat" || view === "map" ? combat.usePotion : undefined;

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
						canUsePotion={combat.potions > 0 && combat.playerHp < maxHp}
						onUsePotion={combat.usePotion}
						teleportStones={character.teleportStones ?? 0}
						canUseTeleportStone={(character.teleportStones ?? 0) > 0}
						onUseTeleportStone={handleUseTeleportStone}
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
					onUseTeleportStone={handleUseTeleportStone}
					onShowStats={statsModal.open}
				/>
			</aside>

			<BagPreviewModal
				isOpen={bagModal.isOpen}
				onClose={bagModal.close}
				items={zoneBag ?? []}
			/>
			<ExitZoneModal
				isOpen={exitModal.isOpen}
				onClose={handleCloseExit}
				onPickSelected={handlePickSelected}
				onDiscardSelected={handleDiscardSelected}
				onPickAll={handlePickAll}
				onDiscardAll={handleDiscardAll}
				bagItems={zoneBag ?? []}
				keepCap={exitKeepCap}
			/>
			<ShowStatsModal
				isOpen={statsModal.isOpen}
				onClose={statsModal.close}
				stats={stats}
				referenceEnemyLevel={zoneLevel}
				currentBarrier={combat.barrier.current}
				currentLife={combat.playerHp}
			/>
			<InventoryModal
				isOpen={inventoryModal.isOpen}
				onClose={inventoryModal.close}
				characterId={character._id}
				stats={stats}
				characterLevel={character.level}
				equippedItems={equippedItems ?? []}
				inventoryItems={inventoryItems ?? []}
			/>
			<VendorModal
				isOpen={vendorModal.isOpen}
				onClose={vendorModal.close}
				rubys={character.rubys ?? 0}
				potions={character.potions ?? 0}
				teleportStones={character.teleportStones ?? 0}
				inventoryItems={inventoryItems ?? []}
				onBuy={async (productId) => {
					await vendorBuy({ characterId: character._id, productId });
				}}
				onSellMany={async (itemIds) => {
					await vendorSellMany({ characterId: character._id, itemIds });
				}}
			/>
			<SettingsModal
				isOpen={settingsModal.isOpen}
				onClose={settingsModal.close}
			/>
		</main>
	);
}
