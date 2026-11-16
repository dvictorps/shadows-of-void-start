// World-route mutations bundled into one hook. There is no reactivity on D1
// (ADR 0009), so every mutation writes its result into the react-query cache
// (`src/lib/world-cache.ts`); the ones in ADR 0001's list also paint the
// result optimistically in `onMutate` and roll back in `onError`.
//
// Single-active-session threading: every mutation is wrapped with
// `useSessionedMutation` so the public signature stays session-free —
// consumers (world.tsx, useViewMode) pass `{ characterId, ... }` while the
// per-tab token is injected here. See docs/security/threat-model.md →
// Threat #5.

import { useMutation } from "@tanstack/react-query";

import {
	createInventorySlotAllocator,
	createStashSlotAllocator,
} from "#/game/inventory/constants";
import { stashModeOf } from "#/game/inventory/stash-mode";
import { computeSellPrice } from "#/game/items/sell-price";
import { findVendorProduct } from "#/game/vendor/products";
import { resolvePurchase } from "#/game/vendor/purchase";
import {
	CLEARED_VISIT,
	resolveTeleport,
	resolveTravelStart,
	type TravelCharacter,
} from "#/game/world/zone-actions";
import { useTRPC } from "#/integrations/trpc/client";
import type { ItemRow } from "#/lib/api-types";
import {
	moveToSlot,
	rollbackOnError,
	useWorldCache,
	withoutBagEntries,
} from "#/lib/world-cache";

import { useSessionedMutation } from "./useSessionToken";

// The optimistic travel predictions run the server's own decisions
// (src/game/world/zone-actions.ts), so a trip the server would refuse is never
// painted. At module scope because they read the clock: the mutation
// callbacks call them when they fire, never during render.
function predictTravel(character: TravelCharacter, destination: string) {
	return resolveTravelStart(character, destination, Date.now());
}
function predictTeleport(character: TravelCharacter, destination: string) {
	return resolveTeleport(character, destination, Date.now());
}

export function useWorldMutations({
	characterId,
	movementSpeed,
}: {
	characterId: number;
	movementSpeed: number;
}) {
	const trpc = useTRPC();
	const cache = useWorldCache(characterId);
	const { keys } = cache;

	// New items from the bag get their ids on the server, so the inventory
	// takes the returned rows instead of guessing them optimistically.
	const addToInventory = (rows: readonly ItemRow[]) => {
		const inventory = cache.inventory();
		if (inventory) cache.setInventory([...inventory, ...rows]);
	};

	// Camp pick and discard both take the entries out of the bag at once.
	const removeFromBag = async ({ itemIds }: { itemIds: string[] }) => {
		const rollback = await cache.snapshot([keys.zoneBag]);
		const bag = cache.zoneBag();
		if (bag) cache.setZoneBag(withoutBagEntries(bag, itemIds));
		return { rollback };
	};

	const enterCity = useSessionedMutation(
		useMutation(
			trpc.combat.enterCity.mutationOptions({
				onSuccess: ({ hpCurrent, potions }) => {
					const character = cache.character();
					if (!character) return;
					cache.patchCharacter({
						hpCurrent,
						potions,
						barrierCurrent: character.cachedMaxBarrier,
					});
				},
			}),
		).mutateAsync,
	);

	const enterZone = useSessionedMutation(
		useMutation(
			trpc.combat.enterZone.mutationOptions({
				onSuccess: (visit) => {
					const character = cache.character();
					if (!character) return;
					cache.patchCharacter({
						...CLEARED_VISIT,
						currentZoneSession: visit.zoneSession,
						zoneStartedAt: visit.zoneStartedAt,
						campThresholdsMs: visit.campThresholdsMs,
						currentZoneKills: 0,
						hpCurrent: character.cachedMaxLife,
						barrierCurrent: character.cachedMaxBarrier,
					});
					cache.setZoneBag([]);
				},
			}),
		).mutateAsync,
	);

	// Optimistic: the bag empties and the visit ends at once; the kept items
	// join the inventory when the server returns them.
	const exitZone = useSessionedMutation(
		useMutation(
			trpc.items.exitZone.mutationOptions({
				onMutate: async () => {
					const rollback = await cache.snapshot([keys.zoneBag, keys.character]);
					cache.setZoneBag([]);
					cache.patchCharacter(CLEARED_VISIT);
					return { rollback };
				},
				onError: rollbackOnError,
				onSuccess: ({ items }) => addToInventory(items),
			}),
		).mutateAsync,
	);

	const pickFromBag = useSessionedMutation(
		useMutation(
			trpc.items.pickFromBag.mutationOptions({
				onMutate: removeFromBag,
				onError: rollbackOnError,
				onSuccess: ({ items }) => addToInventory(items),
			}),
		).mutateAsync,
	);

	const discardFromBag = useSessionedMutation(
		useMutation(
			trpc.items.discardFromBag.mutationOptions({
				onMutate: removeFromBag,
				onError: rollbackOnError,
			}),
		).mutateAsync,
	);

	// Server-only (ADR 0001): the XP penalty is decided there. Softcore stays
	// in /world, so the character is refetched; hardcore navigates away.
	const respawnDead = useSessionedMutation(
		useMutation(
			trpc.combat.respawnDead.mutationOptions({
				onSuccess: () => {
					cache.setZoneBag([]);
					cache.invalidate([keys.character]);
				},
			}),
		).mutateAsync,
	);

	// `movementSpeed` is read when the mutation fires: useMutation picks up
	// this render's options, so the closure is never stale.
	const startTravel = useSessionedMutation(
		useMutation(
			trpc.combat.startTravel.mutationOptions({
				onMutate: async ({ destinationNodeId }) => {
					const rollback = await cache.snapshot([keys.character]);
					const character = cache.character();
					// This render's movement speed: the cached row's stat cache lags an
					// equip until the next refetch.
					const travel =
						character &&
						predictTravel(
							{ ...character, cachedMovementSpeed: movementSpeed },
							destinationNodeId,
						);
					if (travel?.ok) {
						cache.patchCharacter({
							travelDestination: destinationNodeId,
							travelStartedAt: travel.startedAt,
							travelArrivesAt: travel.arrivesAt,
						});
					}
					return { rollback };
				},
				onError: rollbackOnError,
				onSuccess: ({ startedAt, arrivesAt }, { destinationNodeId }) =>
					cache.patchCharacter({
						travelDestination: destinationNodeId,
						travelStartedAt: startedAt,
						travelArrivesAt: arrivesAt,
					}),
			}),
		).mutateAsync,
	);

	const arriveAtTravel = useSessionedMutation(
		useMutation(
			trpc.combat.arriveAtTravel.mutationOptions({
				onSuccess: ({ arrivedAt }) => {
					const character = cache.character();
					if (!character) return;
					cache.patchCharacter({
						currentLocation: arrivedAt,
						travelDestination: null,
						travelStartedAt: null,
						travelArrivesAt: null,
						unlockedNodes: character.unlockedNodes.includes(arrivedAt)
							? character.unlockedNodes
							: [...character.unlockedNodes, arrivedAt],
					});
				},
			}),
		).mutateAsync,
	);

	// Optimistic so fast repeat clicks don't outrun the cache and trip "cap
	// reached" / "Not enough rubys" from a stale view.
	const vendorBuy = useSessionedMutation(
		useMutation(
			trpc.vendor.vendorBuy.mutationOptions({
				onMutate: async ({ productId, quantity }) => {
					const rollback = await cache.snapshot([keys.character]);
					const character = cache.character();
					const product = findVendorProduct(productId);
					if (!character || !product) return { rollback };
					const currentCount = character[product.counterField];
					const purchase = resolvePurchase({
						product,
						quantity,
						rubys: character.rubys,
						currentCount,
					});
					if (purchase.ok) {
						cache.patchCharacter({
							rubys: character.rubys - purchase.cost,
							[product.counterField]: currentCount + quantity,
						});
					}
					return { rollback };
				},
				onError: rollbackOnError,
				onSuccess: ({ rubys, counterField, count }) =>
					cache.patchCharacter({ rubys, [counterField]: count }),
			}),
		).mutateAsync,
	);

	// `consumeTeleportStone`, aliased to a name without the `use` prefix the
	// hooks lint rule would flag.
	const teleportStone = useSessionedMutation(
		useMutation(
			trpc.combat.consumeTeleportStone.mutationOptions({
				onMutate: async ({ destinationNodeId }) => {
					const rollback = await cache.snapshot([keys.character, keys.zoneBag]);
					const character = cache.character();
					const destination = destinationNodeId ?? "city";
					const jump = character && predictTeleport(character, destination);
					if (character && jump?.ok) {
						cache.patchCharacter({
							...CLEARED_VISIT,
							teleportStones: character.teleportStones - 1,
							travelDestination: destination,
							travelStartedAt: jump.startedAt,
							travelArrivesAt: jump.arrivesAt,
						});
						cache.setZoneBag([]);
					}
					return { rollback };
				},
				onError: rollbackOnError,
				// The full write, so the cache is right even when the prediction
				// bailed: visit and bag cleared, and the city refill when it applies.
				onSuccess: (written) => {
					cache.patchCharacter({ ...CLEARED_VISIT, ...written });
					cache.setZoneBag([]);
				},
			}),
		).mutateAsync,
	);

	const switchElement = useSessionedMutation(
		useMutation(
			trpc.combat.switchElement.mutationOptions({
				onSuccess: (attunement) => cache.patchCharacter(attunement),
			}),
		).mutateAsync,
	);

	const vendorSellMany = useSessionedMutation(
		useMutation(
			trpc.vendor.vendorSellMany.mutationOptions({
				onMutate: async ({ itemIds }) => {
					const rollback = await cache.snapshot([
						keys.inventory,
						keys.character,
					]);
					const inventory = cache.inventory();
					const character = cache.character();
					if (!inventory || !character) return { rollback };
					const sold = new Set(itemIds);
					const total = inventory
						.filter((it) => sold.has(it.id))
						.reduce((sum, it) => sum + computeSellPrice(it.data), 0);
					cache.setInventory(inventory.filter((it) => !sold.has(it.id)));
					cache.patchCharacter({ rubys: character.rubys + total });
					return { rollback };
				},
				onError: rollbackOnError,
				onSuccess: ({ rubys }) => cache.patchCharacter({ rubys }),
			}),
		).mutateAsync,
	);

	// Deposit and withdraw move what fits; the rest fails server-side, and
	// then the client refetches both sides rather than guess which ones.
	const depositToStash = useSessionedMutation(
		useMutation(
			trpc.stash.depositToStash.mutationOptions({
				onMutate: async ({ itemIds }) => {
					const character = cache.character();
					if (!character) return;
					const mode = stashModeOf(character);
					const rollback = await cache.snapshot([
						keys.inventory,
						keys.stash(mode),
					]);
					const inventory = cache.inventory();
					const stash = cache.stash(mode);
					if (!inventory || !stash) return { rollback };
					const requested = new Set(itemIds);
					const nextSlot = createStashSlotAllocator(stash);
					const moved: ItemRow[] = [];
					for (const item of inventory.filter((it) => requested.has(it.id))) {
						const slot = nextSlot();
						if (slot === -1) break;
						moved.push({
							...item,
							locationKind: "stash",
							characterId: null,
							inventorySlot: null,
							stashSlot: slot,
							stashMode: mode,
						});
					}
					const movedIds = new Set(moved.map((it) => it.id));
					cache.setInventory(inventory.filter((it) => !movedIds.has(it.id)));
					cache.setStash(mode, [...stash, ...moved]);
					return { rollback };
				},
				onError: rollbackOnError,
				onSuccess: ({ failed }) => {
					const character = cache.character();
					if (failed > 0 && character) {
						cache.invalidate([
							keys.inventory,
							keys.stash(stashModeOf(character)),
						]);
					}
				},
			}),
		).mutateAsync,
	);

	const withdrawFromStash = useSessionedMutation(
		useMutation(
			trpc.stash.withdrawFromStash.mutationOptions({
				onMutate: async ({ itemIds }) => {
					const character = cache.character();
					if (!character) return;
					const mode = stashModeOf(character);
					const rollback = await cache.snapshot([
						keys.inventory,
						keys.stash(mode),
					]);
					const inventory = cache.inventory();
					const stash = cache.stash(mode);
					if (!inventory || !stash) return { rollback };
					const requested = new Set(itemIds);
					const nextSlot = createInventorySlotAllocator(inventory);
					const moved: ItemRow[] = [];
					for (const item of stash.filter((it) => requested.has(it.id))) {
						const slot = nextSlot();
						if (slot === -1) break;
						moved.push({
							...item,
							locationKind: "inventory",
							characterId,
							stashSlot: null,
							stashMode: null,
							inventorySlot: slot,
						});
					}
					const movedIds = new Set(moved.map((it) => it.id));
					cache.setStash(
						mode,
						stash.filter((it) => !movedIds.has(it.id)),
					);
					cache.setInventory([...inventory, ...moved]);
					return { rollback };
				},
				onError: rollbackOnError,
				onSuccess: ({ failed }) => {
					const character = cache.character();
					if (failed > 0 && character) {
						cache.invalidate([
							keys.inventory,
							keys.stash(stashModeOf(character)),
						]);
					}
				},
			}),
		).mutateAsync,
	);

	const reorderStash = useSessionedMutation(
		useMutation(
			trpc.stash.reorderStash.mutationOptions({
				onMutate: async (move) => {
					const character = cache.character();
					if (!character) return;
					const mode = stashModeOf(character);
					const rollback = await cache.snapshot([keys.stash(mode)]);
					const stash = cache.stash(mode);
					const next = stash && moveToSlot(stash, "stashSlot", move);
					if (next) cache.setStash(mode, next);
					return { rollback };
				},
				onError: rollbackOnError,
			}),
		).mutateAsync,
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
		depositToStash,
		withdrawFromStash,
		reorderStash,
	};
}
