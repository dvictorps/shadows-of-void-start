import { and, eq, getTableColumns, type SQL, sql } from "drizzle-orm";
import type { SQLiteUpdateSetSource } from "drizzle-orm/sqlite-core";

import type { GeneratedItem } from "#/game/items/types";
import { typedKeys } from "#/game/typed-object";
import { CLEARED_VISIT } from "#/game/world/zone-actions";

import type { Database } from "./db/client";
import { characters, items, type ZoneBagEntry } from "./db/schema";

type ItemRow = typeof items.$inferSelect;

// The zone bag lives in `characters.zone_bag` as a JSON array (see the
// game-schema.ts header for the write-budget reason). Everything that edits
// it does so inside SQL, so:
//   - a kill appends with `json_insert` and the Worker never parses the bag;
//   - a pick-up copies the item from the stored entry into `items` with
//     INSERT … SELECT, so the item data never comes from the client, and an
//     entry that is already gone (a concurrent pick, an exit that cleared the
//     session) inserts nothing. That's what stops a duplicated request from
//     duplicating the item.

// `items` columns in table order, which is the order Drizzle writes in an
// INSERT column list.
const ITEM_COLUMNS = typedKeys(getTableColumns(items));

/** Wraps freshly rolled drops in bag entries with server-issued ids. */
export function toBagEntries(
	drops: GeneratedItem[],
	droppedFrom: string,
	droppedFromLevel: number,
	droppedAt: number,
): ZoneBagEntry[] {
	return drops.map((data) => ({
		bagId: crypto.randomUUID(),
		data,
		droppedAt,
		droppedFrom,
		droppedFromLevel,
	}));
}

/**
 * `zone_bag` value that appends `entries`, for an UPDATE's `set`. Appends
 * only while the visit is still `zoneSession`, so a kill racing an exit
 * doesn't drop into the next visit's bag.
 */
export function appendToBag(entries: ZoneBagEntry[], zoneSession: string): SQL {
	const pairs = sql.join(
		entries.map((entry) => sql`'$[#]', json(${JSON.stringify(entry)})`),
		sql`, `,
	);
	return sql`case when ${characters.currentZoneSession} = ${zoneSession} then json_insert(${characters.zoneBag}, ${pairs}) else ${characters.zoneBag} end`;
}

/** `zone_bag` value without the entries in `bagIds`. */
export function removeFromBag(bagIds: readonly string[]): SQL {
	const ids = sql.join(
		bagIds.map((id) => sql`${id}`),
		sql`, `,
	);
	return sql`(select json_group_array(json(e.value)) from json_each(${characters.zoneBag}) e where json_extract(e.value, '$.bagId') not in (${ids}))`;
}

export interface BagPick {
	bagId: string;
	inventorySlot: number;
}

/**
 * Copies the picked entries from the bag into the inventory, then applies
 * `bagUpdate` to the character row, in one batch. Returns the items really
 * inserted, so the client can put them in its inventory cache with their new
 * ids (there is no reactivity to tell it).
 *
 * Each INSERT only matches while its entry is still in the bag of the same
 * zone session, so the order matters: inserts first, then the update that
 * removes the entries (or clears the whole visit). The FROM / WHERE are raw
 * SQL because Drizzle has no builder for `json_each` (and `db.run(sql)` can't
 * go in a D1 batch with parameters in drizzle-orm 0.45: its `SQLiteRaw` has
 * no prepared statement to bind).
 */
export async function commitBagPicks(
	db: Database,
	characterId: number,
	zoneSession: string,
	picks: BagPick[],
	bagUpdate: SQLiteUpdateSetSource<typeof characters>,
): Promise<ItemRow[]> {
	const update = db
		.update(characters)
		.set(bagUpdate)
		.where(inZoneSession(characterId, zoneSession));
	const [first, ...rest] = picks.map(({ bagId, inventorySlot }) => {
		// A value for every `items` column, checked by the type; the SELECT list
		// follows ITEM_COLUMNS.
		const values = {
			id: sql`null`,
			authUserId: sql`c.auth_user_id`,
			locationKind: sql`'inventory'`,
			characterId: sql`c.id`,
			equippedSlot: sql`null`,
			inventorySlot: sql`${inventorySlot}`,
			stashMode: sql`null`,
			stashSlot: sql`null`,
			data: sql`json_extract(e.value, '$.data')`,
			droppedAt: sql`json_extract(e.value, '$.droppedAt')`,
			droppedFrom: sql`json_extract(e.value, '$.droppedFrom')`,
			droppedFromLevel: sql`json_extract(e.value, '$.droppedFromLevel')`,
		} satisfies Record<keyof typeof items.$inferSelect, SQL>;
		return db
			.insert(items)
			.select(sql`
			select ${sql.join(
				ITEM_COLUMNS.map((key) => values[key]),
				sql`, `,
			)}
			from characters c, json_each(c.zone_bag) e
			where c.id = ${characterId} and c.current_zone_session = ${zoneSession}
				and json_extract(e.value, '$.bagId') = ${bagId}`)
			.returning();
	});
	if (!first) {
		await update;
		return [];
	}
	const results = await db.batch([first, ...rest, update]);
	// Each INSERT … RETURNING yields its row, or nothing when its entry was
	// already gone; the last result is the UPDATE.
	return results
		.slice(0, picks.length)
		.flatMap((rows) => (Array.isArray(rows) ? rows : []));
}

/** WHERE clause for a write that only applies to this zone visit. */
export function inZoneSession(characterId: number, zoneSession: string) {
	return and(
		eq(characters.id, characterId),
		eq(characters.currentZoneSession, zoneSession),
	);
}

/**
 * The ids of the staged drops, extracted in SQL so the Worker never parses
 * the item data of a large bag just to validate a pick.
 */
export async function loadBagIds(
	db: Database,
	characterId: number,
): Promise<string[]> {
	const rows = await db.all<{ bagId: string }>(
		sql`select json_extract(e.value, '$.bagId') as bagId from ${characters}, json_each(${characters.zoneBag}) e where ${characters.id} = ${characterId}`,
	);
	return rows.map((row) => row.bagId);
}

// `CLEARED_VISIT` (shared with the client's cache) plus the bag. Clearing
// the bag here is what wipes unclaimed drops, at no extra row written.
// `currentZoneKills` is reset separately by the procedures that need it.
export const CLEARED_ZONE = {
	...CLEARED_VISIT,
	zoneBag: [],
} satisfies Partial<typeof characters.$inferInsert>;
