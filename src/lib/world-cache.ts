// The /world route's view of the react-query cache: typed keys and small
// read / patch helpers for the queries every world mutation touches, plus
// the snapshot / rollback pair the optimistic updates use (ADR 0001).
//
// There is no reactivity on D1 (ADR 0009): a mutation either writes its
// result into these queries or invalidates them. Lives in `src/lib/` so the
// route's mutation hooks and the combat hooks share it without importing
// each other.

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

		/** Merges `delta` into the cached character; no-op before it loads. */
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
		/** Refetches queries the client can't predict (e.g. after a death). */
		invalidate(queryKeys: readonly QueryKey[]): void {
			for (const queryKey of queryKeys) {
				void queryClient.invalidateQueries({ queryKey });
			}
		},

		/**
		 * Snapshots `queryKeys` before an optimistic write. In-flight fetches of
		 * them are cancelled first, so a late response can't paint over the
		 * optimistic state. The returned `rollback` restores the snapshot and
		 * refetches: other writes may have landed on the same queries since
		 * (a kill during a failed potion), and the server has the truth.
		 */
		async snapshot(queryKeys: readonly QueryKey[]): Promise<Rollback> {
			// A query with no data yet is left alone: cancelling its first fetch
			// would leave it empty until the next refetch.
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

/**
 * The reorder the server does for inventory and stash alike: `itemId` moves
 * to `targetSlot`, and `swapWithItemId` takes the source's slot only when it
 * really sits in `targetSlot`. Null when the item isn't in `rows`.
 */
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

/** The bag without the entries in `bagIds`. */
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

/**
 * `onError` for an optimistic mutation whose `onMutate` returned
 * `{ rollback }` from `cache.snapshot(...)`. The optimistic body itself fails
 * closed (ADR 0001): when it can't predict the result it writes nothing, and
 * the UI waits for the server like a plain mutation.
 */
export function rollbackOnError<TError, TVariables>(
	_error: TError,
	_variables: TVariables,
	result: { rollback: Rollback } | undefined,
): void {
	result?.rollback();
}
