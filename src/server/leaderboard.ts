import { sql } from "drizzle-orm";

import { batchAll, type Database } from "./db/client";
import {
	characters,
	LEADERBOARD_CATEGORIES,
	type LeaderboardEntry,
	leaderboardSnapshot,
	STASH_MODES,
} from "./db/schema";

// Hourly leaderboard snapshot (ADR 0006), run by the Worker's `scheduled`
// handler (src/server.ts).
// There is no leaderboard index (it would cost a write on every kill), so one
// query scans `characters` once an hour and ranks both categories per mode
// with window functions; then the four snapshot rows are upserted.

export const LEADERBOARD_SIZE = 50;

const RANK_COLUMN = { level: "levelRank", bossKills: "bossRank" } as const;

async function rankCharacters(db: Database) {
	const ranked = db
		.select({
			characterId: characters.id,
			characterName: characters.name,
			classId: characters.classId,
			level: characters.level,
			xp: characters.xp,
			totalBossKills: characters.totalBossKills,
			hardcore: characters.hardcore,
			dead: characters.dead,
			levelRank:
				sql<number>`row_number() over (partition by ${characters.hardcore} order by ${characters.level} desc, ${characters.xp} desc)`.as(
					"level_rank",
				),
			bossRank:
				sql<number>`row_number() over (partition by ${characters.hardcore} order by ${characters.totalBossKills} desc, ${characters.level} desc, ${characters.xp} desc)`.as(
					"boss_rank",
				),
		})
		.from(characters)
		.as("ranked");
	return db
		.select()
		.from(ranked)
		.where(
			sql`${ranked.levelRank} <= ${LEADERBOARD_SIZE} or ${ranked.bossRank} <= ${LEADERBOARD_SIZE}`,
		);
}

export async function computeLeaderboardSnapshot(
	db: Database,
	now: number,
): Promise<void> {
	const ranked = await rankCharacters(db);
	await batchAll(
		db,
		LEADERBOARD_CATEGORIES.flatMap((category) =>
			STASH_MODES.map((mode) => {
				const rank = RANK_COLUMN[category];
				const entries: LeaderboardEntry[] = ranked
					.filter(
						(row) =>
							row.hardcore === (mode === "hardcore") &&
							row[rank] <= LEADERBOARD_SIZE,
					)
					.toSorted((a, b) => a[rank] - b[rank])
					.map(({ levelRank: _level, bossRank: _boss, ...entry }) => entry);
				return db
					.insert(leaderboardSnapshot)
					.values({ category, mode, entries, updatedAt: now })
					.onConflictDoUpdate({
						target: [leaderboardSnapshot.category, leaderboardSnapshot.mode],
						set: {
							entries: sql`excluded.entries`,
							updatedAt: sql`excluded.updated_at`,
						},
					});
			}),
		),
	);
}
