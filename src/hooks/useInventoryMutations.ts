// Inventory and paper-doll mutations (ADR 0001: all optimistic). Shared by
// InventoryModal and the stash modal's inventory side. Each optimistic body
// runs the server's own decision (`resolveEquip` / `resolveUnequip`,
// `moveToSlot`, the slot allocator), so the predicted state is the one the
// server writes; when it can't predict (missing cache, a refused move) it
// writes nothing and the UI waits for the server.

import { useMutation } from "@tanstack/react-query";

import { createInventorySlotAllocator } from "#/game/inventory/constants";
import {
	type EquippedEntry,
	resolveEquip,
	resolveUnequip,
} from "#/game/items/equip-resolution";
import { useTRPC } from "#/integrations/trpc/client";
import type { ItemRow } from "#/lib/api-types";
import { moveToSlot, rollbackOnError, useWorldCache } from "#/lib/world-cache";

import { useSessionedMutation } from "./useSessionToken";

// Equipped rows in the shape the shared equip decisions take.
function toEntries(equipped: readonly ItemRow[]): EquippedEntry<number>[] {
	return equipped.flatMap((it) =>
		it.equippedSlot
			? [{ id: it.id, slot: it.equippedSlot, item: it.data }]
			: [],
	);
}

function toInventoryRow(row: ItemRow, inventorySlot: number): ItemRow {
	return {
		...row,
		locationKind: "inventory",
		equippedSlot: null,
		inventorySlot,
	};
}

export function useInventoryMutations(characterId: number) {
	const trpc = useTRPC();
	const cache = useWorldCache(characterId);
	const { keys } = cache;

	const reorderInventory = useSessionedMutation(
		useMutation(
			trpc.items.reorderInventory.mutationOptions({
				onMutate: async (move) => {
					const rollback = await cache.snapshot([keys.inventory]);
					const inventory = cache.inventory();
					const next =
						inventory && moveToSlot(inventory, "inventorySlot", move);
					if (next) cache.setInventory(next);
					return { rollback };
				},
				onError: rollbackOnError,
			}),
		).mutateAsync,
	);

	// Both run the server's own decision (src/game/items/equip-resolution.ts):
	// requirements, displacement, the orphaned quiver and the inventory limit.
	const equipItem = useSessionedMutation(
		useMutation(
			trpc.items.equipItem.mutationOptions({
				onMutate: async ({ itemId, targetSlot }) => {
					const rollback = await cache.snapshot([
						keys.inventory,
						keys.equipped,
					]);
					const character = cache.character();
					const inventory = cache.inventory();
					const equipped = cache.equipped();
					const item = inventory?.find((it) => it.id === itemId);
					if (!character || !inventory || !equipped || !item) {
						return { rollback };
					}
					const result = resolveEquip({
						character,
						item: item.data,
						targetSlot,
						equipped: toEntries(equipped),
						inventoryUsed: inventory.length,
					});
					if (!result.ok) return { rollback };

					// The equipped item's old slot frees up first and may receive a
					// displaced one, as on the server.
					const rest = inventory.filter((it) => it.id !== itemId);
					const nextSlot = createInventorySlotAllocator(rest);
					const displacedIds = new Set(result.displaced.map((d) => d.id));
					cache.setInventory([
						...rest,
						...equipped
							.filter((it) => displacedIds.has(it.id))
							.map((it) => toInventoryRow(it, nextSlot())),
					]);
					cache.setEquipped([
						...equipped.filter((it) => !displacedIds.has(it.id)),
						{
							...item,
							locationKind: "equipped",
							equippedSlot: targetSlot,
							inventorySlot: null,
						},
					]);
					return { rollback };
				},
				onError: rollbackOnError,
			}),
		).mutateAsync,
	);

	const unequipItem = useSessionedMutation(
		useMutation(
			trpc.items.unequipItem.mutationOptions({
				onMutate: async ({ slot }) => {
					const rollback = await cache.snapshot([
						keys.inventory,
						keys.equipped,
					]);
					const inventory = cache.inventory();
					const equipped = cache.equipped();
					if (!inventory || !equipped) return { rollback };
					const result = resolveUnequip({
						slot,
						equipped: toEntries(equipped),
						inventoryUsed: inventory.length,
					});
					if (!result.ok) return { rollback };

					const nextSlot = createInventorySlotAllocator(inventory);
					const leaving = new Set(result.toInventory.map((e) => e.id));
					cache.setInventory([
						...inventory,
						...equipped
							.filter((it) => leaving.has(it.id))
							.map((it) => toInventoryRow(it, nextSlot())),
					]);
					cache.setEquipped(
						equipped
							.filter((it) => !leaving.has(it.id))
							.map((it) =>
								it.id === result.promoted?.id
									? { ...it, equippedSlot: "weapon" as const }
									: it,
							),
					);
					return { rollback };
				},
				onError: rollbackOnError,
			}),
		).mutateAsync,
	);

	const swapHands = useSessionedMutation(
		useMutation(
			trpc.items.swapHands.mutationOptions({
				onMutate: async () => {
					const rollback = await cache.snapshot([keys.equipped]);
					const equipped = cache.equipped();
					const main = equipped?.find((it) => it.equippedSlot === "weapon");
					const off = equipped?.find((it) => it.equippedSlot === "offhand");
					if (!equipped || !main || !off) return { rollback };
					cache.setEquipped(
						equipped.map((it) => {
							if (it.id === main.id) {
								return { ...it, equippedSlot: "offhand" as const };
							}
							if (it.id === off.id) {
								return { ...it, equippedSlot: "weapon" as const };
							}
							return it;
						}),
					);
					return { rollback };
				},
				onError: rollbackOnError,
			}),
		).mutateAsync,
	);

	const discardFromInventory = useSessionedMutation(
		useMutation(
			trpc.items.discardFromInventory.mutationOptions({
				onMutate: async ({ itemId }) => {
					const rollback = await cache.snapshot([keys.inventory]);
					const inventory = cache.inventory();
					if (inventory) {
						cache.setInventory(inventory.filter((it) => it.id !== itemId));
					}
					return { rollback };
				},
				onError: rollbackOnError,
			}),
		).mutateAsync,
	);

	return {
		reorderInventory,
		equipItem,
		unequipItem,
		swapHands,
		discardFromInventory,
	};
}
