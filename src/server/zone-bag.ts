import { and, eq, getTableColumns, type SQL, sql } from "drizzle-orm";
import type { SQLiteUpdateSetSource } from "drizzle-orm/sqlite-core";

import type { GeneratedItem } from "#/game/items/types";
import { typedKeys } from "#/game/typed-object";
import { CLEARED_VISIT } from "#/game/world/zone-actions";

import type { Database } from "./db/client";
import { characters, items, type ZoneBagEntry } from "./db/schema";

type ItemRow = typeof items.$inferSelect;

const ITEM_COLUMNS = typedKeys(getTableColumns(items));

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

export function appendToBag(entries: ZoneBagEntry[], zoneSession: string): SQL {
	const pairs = sql.join(
		entries.map((entry) => sql`'$[#]', json(${JSON.stringify(entry)})`),
		sql`, `,
	);
	return sql`case when ${characters.currentZoneSession} = ${zoneSession} then json_insert(${characters.zoneBag}, ${pairs}) else ${characters.zoneBag} end`;
}

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
	if (first === undefined) {
		await update;
		return [];
	}
	const results = await db.batch([first, ...rest, update]);
	return results
		.slice(0, picks.length)
		.flatMap((rows) => (Array.isArray(rows) ? rows : []));
}

export function inZoneSession(characterId: number, zoneSession: string) {
	return and(
		eq(characters.id, characterId),
		eq(characters.currentZoneSession, zoneSession),
	);
}

export async function loadBagIds(
	db: Database,
	characterId: number,
): Promise<string[]> {
	const rows = await db.all<{ bagId: string }>(
		sql`select json_extract(e.value, '$.bagId') as bagId from ${characters}, json_each(${characters.zoneBag}) e where ${characters.id} = ${characterId}`,
	);
	return rows.map((row) => row.bagId);
}

export const CLEARED_ZONE = {
	...CLEARED_VISIT,
	zoneBag: [],
} satisfies Partial<typeof characters.$inferInsert>;
