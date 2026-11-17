import {
	type QueryClient,
	type QueryKey,
	useQueryClient,
} from "@tanstack/react-query";
import { useMemo } from "react";

import { bySlotAsc, byStashSlotAsc } from "#/game/inventory/constants";
import type { StashMode } from "#/game/inventory/stash-mode";
import { type TRPC, useTRPC } from "#/integrations/trpc/client";

import type { BagEntry, CharacterRow, ItemRow } from "./api-types";

export function worldCache(
	trpc: TRPC,
	queryClient: QueryClient,
	characterId: number,
) {
	const keys = {
		character: trpc.characters.byId.queryKey({ id: characterId }),
		inventory: trpc.items.inventory.queryKey({ characterId }),
		equipped: trpc.items.equipped.queryKey({ characterId }),
		zoneBag: trpc.items.zoneBag.queryKey({ characterId }),
		stash: (stashMode: StashMode) => trpc.items.stash.queryKey({ stashMode }),
	};
	return {
		keys,
		character: (): CharacterRow | undefined =>
			queryClient.getQueryData(keys.character) ?? undefined,
		inventory: (): ItemRow[] | undefined =>
			queryClient.getQueryData(keys.inventory),
		equipped: (): ItemRow[] | undefined =>
			queryClient.getQueryData(keys.equipped),
		zoneBag: (): BagEntry[] | undefined =>
			queryClient.getQueryData(keys.zoneBag),
		stash: (stashMode: StashMode): ItemRow[] | undefined =>
			queryClient.getQueryData(keys.stash(stashMode)),

		patchCharacter(delta: Partial<CharacterRow>): void {
			queryClient.setQueryData(keys.character, (row) =>
				row ? { ...row, ...delta } : row,
			);
		},
		setInventory(rows: readonly ItemRow[]): void {
			queryClient.setQueryData(keys.inventory, rows.toSorted(bySlotAsc));
		},
		setEquipped(rows: readonly ItemRow[]): void {
			queryClient.setQueryData(keys.equipped, [...rows]);
		},
		setZoneBag(entries: readonly BagEntry[]): void {
			queryClient.setQueryData(keys.zoneBag, [...entries]);
		},
		setStash(stashMode: StashMode, rows: readonly ItemRow[]): void {
			queryClient.setQueryData(
				keys.stash(stashMode),
				rows.toSorted(byStashSlotAsc),
			);
		},
		invalidate(queryKeys: readonly QueryKey[]): void {
			for (const queryKey of queryKeys) {
				void queryClient.invalidateQueries({ queryKey });
			}
		},

		async snapshot(queryKeys: readonly QueryKey[]): Promise<Rollback> {
			await Promise.all(
				queryKeys
					.filter(
						(queryKey) => queryClient.getQueryData(queryKey) !== undefined,
					)
					.map((queryKey) => queryClient.cancelQueries({ queryKey })),
			);
			const saved = queryKeys.map((queryKey) => ({
				queryKey,
				data: queryClient.getQueryData(queryKey),
			}));
			return () => {
				for (const { queryKey, data } of saved) {
					queryClient.setQueryData(queryKey, data);
					void queryClient.invalidateQueries(
						{ queryKey },
						{ cancelRefetch: false },
					);
				}
			};
		},
	};
}

export type Rollback = () => void;

export function moveToSlot(
	rows: readonly ItemRow[],
	field: "inventorySlot" | "stashSlot",
	move: { itemId: number; targetSlot: number; swapWithItemId?: number },
): ItemRow[] | null {
	const { itemId, targetSlot, swapWithItemId } = move;
	const source = rows.find((it) => it.id === itemId);
	if (!source) return null;
	const occupant = rows.find(
		(it) =>
			it.id === swapWithItemId && it.id !== itemId && it[field] === targetSlot,
	);
	return rows.map((it) => {
		if (it.id === source.id) return { ...it, [field]: targetSlot };
		if (it.id === occupant?.id) return { ...it, [field]: source[field] ?? -1 };
		return it;
	});
}

export function withoutBagEntries(
	bag: readonly BagEntry[],
	bagIds: readonly string[],
): BagEntry[] {
	const removed = new Set(bagIds);
	return bag.filter((entry) => !removed.has(entry.bagId));
}

export type WorldCache = ReturnType<typeof worldCache>;

export function useWorldCache(characterId: number): WorldCache {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	return useMemo(
		() => worldCache(trpc, queryClient, characterId),
		[trpc, queryClient, characterId],
	);
}

export function rollbackOnError<TError, TVariables>(
	_error: TError,
	_variables: TVariables,
	result: { rollback: Rollback } | undefined,
): void {
	result?.rollback();
}
