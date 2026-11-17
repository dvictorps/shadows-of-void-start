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

export {
	STASH_MODES,
	type StashMode,
	stashModeOf,
} from "#/game/inventory/stash-mode";
export const ITEM_LOCATION_KINDS = ["inventory", "equipped", "stash"] as const;
export const LEADERBOARD_CATEGORIES = ["level", "bossKills"] as const;

type BossKillCounts = Partial<Record<BossId, number>>;

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
		classId: text().$type<CharacterClassId>().notNull(),
		level: integer().notNull().default(1),
		xp: integer().notNull().default(0),
		hardcore: integer({ mode: "boolean" }).notNull().default(false),
		dead: integer({ mode: "boolean" }).notNull().default(false),
		createdAt: integer().notNull(),

		hpCurrent: real().notNull(),
		barrierCurrent: real().notNull().default(0),
		potions: integer().notNull().default(0),
		etherealIncense: integer().notNull().default(0),
		rubys: integer().notNull().default(0),
		teleportStones: integer().notNull().default(0),
		windCrystals: integer().notNull().default(0),

		currentZoneSession: text(),
		zoneBag: text({ mode: "json" })
			.$type<ZoneBagEntry[]>()
			.notNull()
			.default(sql`'[]'`),
		currentZoneKills: integer().notNull().default(0),
		gauntletKills: integer().notNull().default(0),
		zoneStartedAt: integer(),
		campThresholdsMs: text({ mode: "json" }).$type<number[]>(),
		zoneBudgetMs: integer(),
		inCamp: integer({ mode: "boolean" }).notNull().default(false),
		lastCampIndex: integer(),

		currentLocation: text().notNull().default("city"),
		travelDestination: text(),
		travelStartedAt: integer(),
		travelArrivesAt: integer(),

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
		totalBossKills: integer().notNull().default(0),

		selectedElement: text({ enum: SELECTABLE_ELEMENTS }),
		lastElementSwitchAt: integer(),

		activeSessionToken: text(),
		activeSessionAt: integer(),

		cachedMaxLife: real().notNull(),
		cachedMaxBarrier: real().notNull().default(0),
		cachedMagicFind: real().notNull().default(0),
		cachedMovementSpeed: real().notNull().default(0),
	},
	(t) => [index("characters_auth_user_id_idx").on(t.authUserId)],
);

export const items = sqliteTable(
	"items",
	{
		id: integer().primaryKey(),
		authUserId: text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		locationKind: text({ enum: ITEM_LOCATION_KINDS }).notNull(),
		characterId: integer().references(() => characters.id, {
			onDelete: "cascade",
		}),
		equippedSlot: text({ enum: EQUIPPED_SLOTS }),
		inventorySlot: integer(),
		stashMode: text({ enum: STASH_MODES }),
		stashSlot: integer(),
		data: text({ mode: "json" }).$type<GeneratedItem>().notNull(),
		droppedAt: integer().notNull(),
		droppedFrom: text(),
		droppedFromLevel: integer(),
	},
	(t) => [
		index("items_character_kind_idx").on(t.characterId, t.locationKind),
		index("items_stash_idx")
			.on(t.authUserId, t.stashMode)
			.where(sql`location_kind = 'stash'`),
	],
);

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
