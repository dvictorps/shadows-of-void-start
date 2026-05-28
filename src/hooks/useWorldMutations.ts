// World-route mutations bundled into one hook. Each optimistic closure
// mirrors the server's recipe so the UI repaints in <16ms instead of
// waiting on the round-trip. See docs/adr/0001-optimistic-mutations.md.
//
// Single-active-session threading: every mutation is wrapped with
// `useSessionedMutation` so the public signature stays session-free —
// consumers (world.tsx, useViewMode) keep passing `{ characterId, ... }`
// while the per-tab token is injected here. See
// docs/security/threat-model.md → Threat #5.

import type { OptimisticLocalStore } from "convex/browser";
import { useMutation } from "convex/react";
import { useRef } from "react";
import { teleportStoneTravelSeconds } from "#/game/combat/constants";
import {
	bySlotAsc,
	byStashSlotAsc,
	createInventorySlotAllocator,
	createStashSlotAllocator,
} from "#/game/inventory/constants";
import { computeSellPrice } from "#/game/items/sell-price";
import { VENDOR_PRODUCTS, type VendorProductId } from "#/game/vendor/products";
import { ACT_1, findNode } from "#/game/world";
import { computeTravelTime } from "#/game/world/travel";
import { applyCharacterDelta, applyCombatStateDelta, findCharacter } from "#/lib/optimistic-character";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { useSessionedMutation } from "./useSessionToken";

// Places the docs into the next available inventory slots, sorted, and
// writes them back through the optimistic store. Shared by exitZone /
// pickFromBag which both move bag docs into inventory. Aborts the
// optimistic write if the live inventory query isn't loaded yet (we
// can't predict slots without it) or if any doc would land in slot -1
// (inventory full — server will reject with "Inventory overflow"; same
// skip-optimistic pattern as InventoryModal's unequipItem).
function moveDocsIntoInventory(
	localStore: OptimisticLocalStore,
	characterId: Id<"characters">,
	docs: ReadonlyArray<Doc<"items">>,
): void {
	if (docs.length === 0) return;
	const bagKey = { characterId };
	const inv = localStore.getQuery(api.items.inventory, bagKey);
	if (!inv) return;
	const nextFreeSlot = createInventorySlotAllocator(inv);
	const moved: Doc<"items">[] = [];
	for (const d of docs) {
		const slot = nextFreeSlot();
		if (slot === -1) return;
		moved.push({
			...d,
			locationKind: "inventory" as const,
			zoneSession: undefined,
			inventorySlot: slot,
		});
	}
	localStore.setQuery(
		api.items.inventory,
		bagKey,
		[...inv, ...moved].sort(bySlotAsc),
	);
}

export function useWorldMutations({
	movementSpeed,
}: {
	movementSpeed: number;
}) {
	// Latest movementSpeed kept in a ref so the startTravel optimistic closure
	// (created once at hook mount) reads the live value at click-time, not the
	// stale value captured when the mutation was declared.
	const movementSpeedRef = useRef(movementSpeed);
	movementSpeedRef.current = movementSpeed;

	const enterCity = useSessionedMutation(useMutation(api.combat.enterCity));
	const enterZone = useSessionedMutation(useMutation(api.combat.enterZone));

	const exitZone = useSessionedMutation(
		useMutation(api.items.exitZone).withOptimisticUpdate((localStore, args) => {
			const char = findCharacter(localStore, args.characterId);
			const zoneSession = char?.currentZoneSession;
			if (!zoneSession) return;
			const bagKey = { zoneSession };
			const bag = localStore.getQuery(api.items.zoneBag, bagKey);
			if (bag) localStore.setQuery(api.items.zoneBag, bagKey, []);
			const keep = new Set(args.keepIds.map((id) => id.toString()));
			const keptDocs = (bag ?? []).filter((it) => keep.has(it._id.toString()));
			moveDocsIntoInventory(localStore, args.characterId, keptDocs);
		}),
	);

	const pickFromBag = useSessionedMutation(
		useMutation(api.items.pickFromBag).withOptimisticUpdate(
			(localStore, args) => {
				const char = findCharacter(localStore, args.characterId);
				const zoneSession = char?.currentZoneSession;
				if (!zoneSession) return;
				const bagKey = { zoneSession };
				const bag = localStore.getQuery(api.items.zoneBag, bagKey);
				if (!bag) return;
				const idSet = new Set(args.itemIds.map((id) => id.toString()));
				const picked = bag.filter((it) => idSet.has(it._id.toString()));
				if (picked.length === 0) return;
				localStore.setQuery(
					api.items.zoneBag,
					bagKey,
					bag.filter((it) => !idSet.has(it._id.toString())),
				);
				moveDocsIntoInventory(localStore, args.characterId, picked);
			},
		),
	);

	const discardFromBag = useSessionedMutation(
		useMutation(api.items.discardFromBag).withOptimisticUpdate(
			(localStore, args) => {
				const char = findCharacter(localStore, args.characterId);
				const zoneSession = char?.currentZoneSession;
				if (!zoneSession) return;
				const bagKey = { zoneSession };
				const bag = localStore.getQuery(api.items.zoneBag, bagKey);
				if (!bag) return;
				const idSet = new Set(args.itemIds.map((id) => id.toString()));
				localStore.setQuery(
					api.items.zoneBag,
					bagKey,
					bag.filter((it) => !idSet.has(it._id.toString())),
				);
			},
		),
	);

	const respawnDead = useSessionedMutation(useMutation(api.combat.respawnDead));

	const startTravel = useSessionedMutation(
		useMutation(api.combat.startTravel).withOptimisticUpdate(
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
		),
	);

	const arriveAtTravel = useSessionedMutation(
		useMutation(api.combat.arriveAtTravel),
	);

	// Vendor mutations with optimistic updates so fast/repeat clicks don't
	// outrun the reactive query and trigger "cap reached" / "item not found"
	// errors from a stale client view.
	const vendorBuy = useSessionedMutation(
		useMutation(api.vendor.vendorBuy).withOptimisticUpdate(
			(localStore, args) => {
				const char = findCharacter(localStore, args.characterId);
				if (!char) return;
				const product = VENDOR_PRODUCTS[args.productId as VendorProductId];
				if (!product) return;
				const qty = args.quantity;
				if (qty <= 0) return;
				const totalCost = product.priceRubys * qty;
				const rubys = char.rubys ?? 0;
				if (rubys < totalCost) return;

				if (product.counterField === "potions") {
					const csData = localStore.getQuery(api.combatState.byCharacterId, { characterId: args.characterId });
					const currentCount = csData?.potions ?? char.potions ?? 0;
					const newCount = currentCount + qty;
					if (product.cap !== undefined && newCount > product.cap) return;
					applyCharacterDelta(localStore, args.characterId, { rubys: rubys - totalCost });
					applyCombatStateDelta(localStore, args.characterId, { potions: newCount });
				} else {
					const currentCount = char[product.counterField] ?? 0;
					const newCount = currentCount + qty;
					if (product.cap !== undefined && newCount > product.cap) return;
					applyCharacterDelta(localStore, args.characterId, {
						rubys: rubys - totalCost,
						[product.counterField]: newCount,
					});
				}
			},
		),
	);

	// Aliased to `teleportStone` (no `use` prefix) so consumers can call it
	// from inside async handlers without tripping biome's useHookAtTopLevel
	// rule — Convex's mutation name happens to start with `use`, but the
	// returned function is a regular async call, not a React hook.
	const teleportStone = useSessionedMutation(
		useMutation(api.combat.useTeleportStone).withOptimisticUpdate(
			(localStore, args) => {
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
					travelDestination: destinationNodeId,
					travelStartedAt: startedAt,
					travelArrivesAt: arrivesAt,
				});
				applyCombatStateDelta(localStore, args.characterId, {
					currentZoneSession: undefined,
					zoneStartedAt: undefined,
					campThresholdsMs: undefined,
					inCamp: false,
					lastCampIndex: undefined,
				});
			},
		),
	);

	const switchElement = useSessionedMutation(
		useMutation(api.combat.switchElement),
	);

	const vendorSellMany = useSessionedMutation(
		useMutation(api.vendor.vendorSellMany).withOptimisticUpdate(
			(localStore, args) => {
				const inventory = localStore.getQuery(api.items.inventory, {
					characterId: args.characterId,
				});
				if (!inventory) return;
				const idSet = new Set(args.itemIds.map((id) => id.toString()));
				const sold = inventory.filter((it) => idSet.has(it._id.toString()));
				if (sold.length === 0) return;
				const total = sold.reduce(
					(sum, it) => sum + computeSellPrice(it.data),
					0,
				);
				localStore.setQuery(
					api.items.inventory,
					{ characterId: args.characterId },
					inventory.filter((it) => !idSet.has(it._id.toString())),
				);
				const char = findCharacter(localStore, args.characterId);
				if (!char) return;
				applyCharacterDelta(localStore, args.characterId, {
					rubys: (char.rubys ?? 0) + total,
				});
			},
		),
	);

	const reorderInventory = useSessionedMutation(
		useMutation(api.items.reorderInventory).withOptimisticUpdate(
			(localStore, args) => {
				const inv = localStore.getQuery(api.items.inventory, {
					characterId: args.characterId,
				});
				if (!inv) return;
				const source = inv.find((it) => it._id === args.itemId);
				if (!source) return;
				const occupant = inv.find((it) => it.inventorySlot === args.targetSlot);
				const sourceSlot = source.inventorySlot;
				const next = inv
					.map((it) => {
						if (it._id === source._id)
							return { ...it, inventorySlot: args.targetSlot };
						if (occupant && it._id === occupant._id)
							return { ...it, inventorySlot: sourceSlot ?? -1 };
						return it;
					})
					.sort(bySlotAsc);
				localStore.setQuery(
					api.items.inventory,
					{ characterId: args.characterId },
					next,
				);
			},
		),
	);

	const depositToStash = useSessionedMutation(
		useMutation(api.stash.depositToStash).withOptimisticUpdate(
			(localStore, args) => {
				const char = findCharacter(localStore, args.characterId);
				if (!char) return;
				const stashMode = char.hardcore ? "hardcore" : "softcore";
				const inv = localStore.getQuery(api.items.inventory, {
					characterId: args.characterId,
				});
				const stash = localStore.getQuery(api.items.stash, {
					stashMode,
				});
				if (!inv || !stash) return;
				const idSet = new Set(args.itemIds.map((id) => id.toString()));
				const toMove = inv.filter((it) => idSet.has(it._id.toString()));
				if (toMove.length === 0) return;
				const nextStashSlot = createStashSlotAllocator(stash);
				const moved: Doc<"items">[] = [];
				for (const item of toMove) {
					const slot = nextStashSlot();
					if (slot === -1) break;
					moved.push({
						...item,
						locationKind: "stash" as const,
						characterId: undefined,
						inventorySlot: undefined,
						stashSlot: slot,
					});
				}
				const movedIds = new Set(moved.map((it) => it._id));
				localStore.setQuery(
					api.items.inventory,
					{ characterId: args.characterId },
					inv.filter((it) => !movedIds.has(it._id)).sort(bySlotAsc),
				);
				localStore.setQuery(
					api.items.stash,
					{ stashMode },
					[...stash, ...moved].sort(byStashSlotAsc),
				);
			},
		),
	);

	const withdrawFromStash = useSessionedMutation(
		useMutation(api.stash.withdrawFromStash).withOptimisticUpdate(
			(localStore, args) => {
				const char = findCharacter(localStore, args.characterId);
				if (!char) return;
				const stashMode = char.hardcore ? "hardcore" : "softcore";
				const inv = localStore.getQuery(api.items.inventory, {
					characterId: args.characterId,
				});
				const stash = localStore.getQuery(api.items.stash, {
					stashMode,
				});
				if (!inv || !stash) return;
				const idSet = new Set(args.itemIds.map((id) => id.toString()));
				const toMove = stash.filter((it) => idSet.has(it._id.toString()));
				if (toMove.length === 0) return;
				const nextInvSlot = createInventorySlotAllocator(inv);
				const moved: Doc<"items">[] = [];
				for (const item of toMove) {
					const slot = nextInvSlot();
					if (slot === -1) break;
					moved.push({
						...item,
						locationKind: "inventory" as const,
						characterId: args.characterId,
						stashSlot: undefined,
						stashMode: undefined,
						inventorySlot: slot,
					});
				}
				const movedIds = new Set(moved.map((it) => it._id));
				localStore.setQuery(
					api.items.stash,
					{ stashMode },
					stash.filter((it) => !movedIds.has(it._id)).sort(byStashSlotAsc),
				);
				localStore.setQuery(
					api.items.inventory,
					{ characterId: args.characterId },
					[...inv, ...moved].sort(bySlotAsc),
				);
			},
		),
	);

	const reorderStash = useSessionedMutation(
		useMutation(api.stash.reorderStash).withOptimisticUpdate(
			(localStore, args) => {
				const char = findCharacter(localStore, args.characterId);
				if (!char) return;
				const stashMode = char.hardcore ? "hardcore" : "softcore";
				const stash = localStore.getQuery(api.items.stash, {
					stashMode,
				});
				if (!stash) return;
				const source = stash.find((it) => it._id === args.itemId);
				if (!source) return;
				const occupant = stash.find((it) => it.stashSlot === args.targetSlot);
				const sourceSlot = source.stashSlot;
				const next = stash
					.map((it) => {
						if (it._id === source._id)
							return { ...it, stashSlot: args.targetSlot };
						if (occupant && it._id === occupant._id)
							return { ...it, stashSlot: sourceSlot ?? -1 };
						return it;
					})
					.sort(byStashSlotAsc);
				localStore.setQuery(api.items.stash, { stashMode }, next);
			},
		),
	);

	return {
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
	};
}
