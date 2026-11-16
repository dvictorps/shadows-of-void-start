import { sql } from "drizzle-orm";
import {
	index,
	integer,
	primaryKey,
	real,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";

import type { BossId } from "#/game/bosses/types";
import type { CharacterClassId } from "#/game/classes/types";
import { STASH_MODES } from "#/game/inventory/stash-mode";
import type { GeneratedItem } from "#/game/items/types";
import { EQUIPPED_SLOTS, SELECTABLE_ELEMENTS } from "#/game/stats/types";

import { user } from "./auth-schema";

// Game tables (ADR 0009). Built clean with no data migration, so there are
// no lazy-migration fallbacks and no optional-for-legacy fields.
//
// Write budget: D1 Free allows 100k rows written per day, and every index
// whose columns a write touches costs one more row written. So the rules are:
//   - Few indexes, none on hot-path columns (xp, level, hp change every kill).
//   - Integer primary keys alias SQLite's rowid, which needs no separate index.
//     Text keys would add one index write per insert.
//   - The character's combat state and progression live on the `characters`
//     row. The old backend split them into separate tables to
//     keep reactive payloads small; without reactivity the split only turns
//     one row written per kill into three.
//   - The zone bag is a JSON column on `characters`, not `items` rows. A drop
//     rides on the character row the kill already writes, and a discarded
//     drop costs nothing; only a picked-up item becomes an `items` row.
// Structured data is a JSON text column typed with `$type<>()` from
// `src/game`, so the game types stay the single source.

export {
	STASH_MODES,
	type StashMode,
	stashModeOf,
} from "#/game/inventory/stash-mode";
export const ITEM_LOCATION_KINDS = ["inventory", "equipped", "stash"] as const;
export const LEADERBOARD_CATEGORIES = ["level", "bossKills"] as const;

type BossKillCounts = Partial<Record<BossId, number>>;

// One staged drop in the zone bag (CONTEXT.md → Loot Pipeline). `bagId` is
// issued by the server when the drop is rolled; the client only ever sends
// it back to pick or discard. The `items` row, and its numeric id, is born on
// pick-up, copied in SQL from this entry.
export interface ZoneBagEntry {
	bagId: string;
	data: GeneratedItem;
	droppedAt: number;
	droppedFrom: string;
	droppedFromLevel: number;
}

export interface LeaderboardEntry {
	characterId: number;
	characterName: string;
	classId: CharacterClassId;
	level: number;
	xp: number;
	totalBossKills: number;
	hardcore: boolean;
	dead: boolean;
}

export const characters = sqliteTable(
	"characters",
	{
		id: integer().primaryKey(),
		authUserId: text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text().notNull(),
		// Plain text in SQL (no CHECK), so adding a class only touches game data.
		classId: text().$type<CharacterClassId>().notNull(),
		level: integer().notNull().default(1),
		xp: integer().notNull().default(0),
		hardcore: integer({ mode: "boolean" }).notNull().default(false),
		// Hardcore death soft-deletes for the leaderboard's "Fallen Heroes".
		dead: integer({ mode: "boolean" }).notNull().default(false),
		createdAt: integer().notNull(),

		// ── Vitals and consumables ──
		hpCurrent: real().notNull(),
		barrierCurrent: real().notNull().default(0),
		potions: integer().notNull().default(0),
		etherealIncense: integer().notNull().default(0),
		rubys: integer().notNull().default(0),
		teleportStones: integer().notNull().default(0),
		windCrystals: integer().notNull().default(0),

		// ── Current zone visit (CONTEXT.md → Zone states). All cleared on
		// exitZone / death.
		currentZoneSession: text(),
		// Staged drops of the current visit. Appended in SQL with
		// `json_insert` (src/server/zone-bag.ts), so a kill never parses it in
		// the Worker; `characterSessionProcedure` doesn't even load it.
		zoneBag: text({ mode: "json" })
			.$type<ZoneBagEntry[]>()
			.notNull()
			.default(sql`'[]'`),
		currentZoneKills: integer().notNull().default(0),
		// Server-authoritative camp/phase derivation: `zoneStartedAt` is the
		// wall-clock ms of enterZone, `campThresholdsMs` the cumulative
		// thresholds it rolled, `lastCampIndex` the highest one consumed.
		zoneStartedAt: integer(),
		campThresholdsMs: text({ mode: "json" }).$type<number[]>(),
		inCamp: integer({ mode: "boolean" }).notNull().default(false),
		lastCampIndex: integer(),

		// ── Travel (CONTEXT.md → Travel system). `currentLocation` stays on the
		// source node during transit; the three travel fields are set and
		// cleared together.
		currentLocation: text().notNull().default("city"),
		travelDestination: text(),
		travelStartedAt: integer(),
		travelArrivesAt: integer(),

		// ── Progression, append-only ──
		unlockedNodes: text({ mode: "json" })
			.$type<string[]>()
			.notNull()
			.$defaultFn(() => ["city"]),
		completedZones: text({ mode: "json" })
			.$type<string[]>()
			.notNull()
			.$defaultFn(() => []),
		bossKillCounts: text({ mode: "json" })
			.$type<BossKillCounts>()
			.notNull()
			.$defaultFn(() => ({})),
		// Sum of `bossKillCounts`, kept so the leaderboard cron sorts on a plain
		// column. Not indexed: the cron scans the table once an hour.
		totalBossKills: integer().notNull().default(0),

		// ── Mage elemental attunement (CONTEXT.md → Elemental Attunement) ──
		selectedElement: text({ enum: SELECTABLE_ELEMENTS }),
		lastElementSwitchAt: integer(),

		// ── Single active session per character (threat #5). Every
		// state-mutating procedure goes through `characterSessionProcedure`,
		// which rejects a token that doesn't match this one.
		activeSessionToken: text(),
		activeSessionAt: integer(),

		// ── Stat cache, refreshed on equip / unequip / level-up so the hot
		// procedures (recordKill, syncHp) skip computeCharacterStats. Written
		// at creation, so never null.
		cachedMaxLife: real().notNull(),
		cachedMaxBarrier: real().notNull().default(0),
		cachedMagicFind: real().notNull().default(0),
		cachedMovementSpeed: real().notNull().default(0),
	},
	// Only index: the character list per account. Leaderboard indexes are
	// left out on purpose: (hardcore, level, xp) would cost a write on every kill.
	(t) => [index("characters_auth_user_id_idx").on(t.authUserId)],
);

// Every possessed item: inventory, equipped, stash. Ids stay stable from
// pick-up on (inventory → equipped → stash). Unclaimed drops live in
// `characters.zoneBag` instead.
export const items = sqliteTable(
	"items",
	{
		id: integer().primaryKey(),
		authUserId: text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		locationKind: text({ enum: ITEM_LOCATION_KINDS }).notNull(),
		// inventory / equipped. Null for stash items, which belong to the
		// account, not a character.
		characterId: integer().references(() => characters.id, {
			onDelete: "cascade",
		}),
		equippedSlot: text({ enum: EQUIPPED_SLOTS }),
		inventorySlot: integer(),
		stashMode: text({ enum: STASH_MODES }),
		stashSlot: integer(),
		data: text({ mode: "json" }).$type<GeneratedItem>().notNull(),
		droppedAt: integer().notNull(),
		// Monster id, "starter" or "vendor". Telemetry / future audit.
		droppedFrom: text(),
		droppedFromLevel: integer(),
	},
	(t) => [
		index("items_character_kind_idx").on(t.characterId, t.locationKind),
		// Partial: only stash rows carry an entry, so pick-ups and inventory moves
		// never write to it.
		index("items_stash_idx")
			.on(t.authUserId, t.stashMode)
			.where(sql`location_kind = 'stash'`),
	],
);

// Written by the hourly cron (ADR 0006), read by the leaderboard modal. The
// composite primary key is the only lookup, so there is no extra index.
export const leaderboardSnapshot = sqliteTable(
	"leaderboard_snapshot",
	{
		category: text({ enum: LEADERBOARD_CATEGORIES }).notNull(),
		mode: text({ enum: STASH_MODES }).notNull(),
		entries: text({ mode: "json" }).$type<LeaderboardEntry[]>().notNull(),
		updatedAt: integer().notNull(),
	},
	(t) => [primaryKey({ columns: [t.category, t.mode] })],
);
