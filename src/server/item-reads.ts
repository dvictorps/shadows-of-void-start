import { and, eq } from "drizzle-orm";

import type { EquippedEntry } from "#/game/items/equip-resolution";
import { SERVER_ERRORS } from "#/lib/server-errors";

import type { Database } from "./db/client";
import { items, type StashMode } from "./db/schema";
import { fail, notFound } from "./trpc/errors";

export function inInventoryOf(characterId: number, id?: number) {
	return and(
		id === undefined ? undefined : eq(items.id, id),
		eq(items.characterId, characterId),
		eq(items.locationKind, "inventory"),
	);
}

export function equippedOf(characterId: number, id?: number) {
	return and(
		id === undefined ? undefined : eq(items.id, id),
		eq(items.characterId, characterId),
		eq(items.locationKind, "equipped"),
	);
}

export function inStash(authUserId: string, mode: StashMode, id?: number) {
	return and(
		id === undefined ? undefined : eq(items.id, id),
		eq(items.authUserId, authUserId),
		eq(items.locationKind, "stash"),
		eq(items.stashMode, mode),
	);
}

export async function loadEquipped(
	db: Database,
	characterId: number,
): Promise<EquippedEntry<number>[]> {
	const rows = await db
		.select({ id: items.id, slot: items.equippedSlot, item: items.data })
		.from(items)
		.where(equippedOf(characterId));
	return rows.flatMap(({ id, slot, item }) =>
		slot ? [{ id, slot, item }] : [],
	);
}

export async function loadInventorySlots(
	db: Database,
	characterId: number,
): Promise<{ inventorySlot: number | null }[]> {
	return db
		.select({ inventorySlot: items.inventorySlot })
		.from(items)
		.where(inInventoryOf(characterId));
}

type ItemRow = typeof items.$inferSelect;

export function assertInventoryItem(
	item: ItemRow | undefined,
	characterId: number,
): ItemRow {
	if (!item) notFound(SERVER_ERRORS.itemNotFound);
	if (item.characterId !== characterId) fail(SERVER_ERRORS.notYourItem);
	if (item.locationKind !== "inventory") fail(SERVER_ERRORS.itemNotInInventory);
	return item;
}

export async function loadInventoryItem(
	db: Database,
	characterId: number,
	id: number,
): Promise<ItemRow> {
	const item = await db.query.items.findFirst({ where: eq(items.id, id) });
	return assertInventoryItem(item, characterId);
}
