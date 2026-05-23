// World-route mutations bundled into one hook. Each optimistic closure
// mirrors the server's recipe so the UI repaints in <16ms instead of
// waiting on the round-trip. See docs/adr/0001-optimistic-mutations.md.

import type { OptimisticLocalStore } from "convex/browser";
import { useMutation } from "convex/react";
import { useRef } from "react";
import { teleportStoneTravelSeconds } from "#/game/combat/constants";
import {
	bySlotAsc,
	createInventorySlotAllocator,
} from "#/game/inventory/constants";
import { computeSellPrice } from "#/game/items/sell-price";
import { VENDOR_PRODUCTS, type VendorProductId } from "#/game/vendor/products";
import { ACT_1, findNode } from "#/game/world";
import { computeTravelTime } from "#/game/world/travel";
import { applyCharacterDelta, findCharacter } from "#/lib/optimistic-character";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";

// Places the docs into the next available inventory slots, sorted, and
// writes them back through the optimistic store. Shared by exitZone /
// pickFromBag which both move bag docs into inventory.
function moveDocsIntoInventory(
	localStore: OptimisticLocalStore,
	characterId: Id<"characters">,
	docs: ReadonlyArray<Doc<"items">>,
): void {
	if (docs.length === 0) return;
	const bagKey = { characterId };
	const inv = localStore.getQuery(api.items.inventory, bagKey) ?? [];
	const nextFreeSlot = createInventorySlotAllocator(inv);
	const moved = docs.map((d) => ({
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

	const enterCity = useMutation(api.combat.enterCity);
	const enterZone = useMutation(api.combat.enterZone);

	const exitZone = useMutation(api.items.exitZone).withOptimisticUpdate(
		(localStore, args) => {
			const bagKey = { characterId: args.characterId };
			const bag = localStore.getQuery(api.items.zoneBag, bagKey);
			if (bag) localStore.setQuery(api.items.zoneBag, bagKey, []);
			const keep = new Set(args.keepIds.map((id) => id.toString()));
			const keptDocs = (bag ?? []).filter((it) => keep.has(it._id.toString()));
			moveDocsIntoInventory(localStore, args.characterId, keptDocs);
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
			localStore.setQuery(
				api.items.zoneBag,
				bagKey,
				bag.filter((it) => !idSet.has(it._id.toString())),
			);
			moveDocsIntoInventory(localStore, args.characterId, picked);
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

	// Aliased to `teleportStone` (no `use` prefix) so consumers can call it
	// from inside async handlers without tripping biome's useHookAtTopLevel
	// rule — Convex's mutation name happens to start with `use`, but the
	// returned function is a regular async call, not a React hook.
	const teleportStone = useMutation(
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
	};
}
