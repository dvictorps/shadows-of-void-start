import { v } from "convex/values"
import { internalMutation, query } from "./_generated/server"

function sumBossKills(counts: unknown): number {
	if (!counts || typeof counts !== "object") return 0
	return Object.values(counts as Record<string, number>).reduce(
		(sum, n) => sum + (typeof n === "number" ? n : 0),
		0,
	)
}

// Pulls the top 50 characters per `(category, mode)` via the matching index.
// Replaces the previous full-table collect — scales O(50) instead of O(users).
// Tiebreak for `level` is `xp` (encoded in the index tuple), matching the
// in-memory sort the previous implementation did.
export const computeSnapshot = internalMutation({
	handler: async (ctx) => {
		const categories = ["level", "bossKills"] as const
		const modes = ["softcore", "hardcore"] as const

		for (const category of categories) {
			for (const mode of modes) {
				const hardcore = mode === "hardcore"

				const top =
					category === "level"
						? await ctx.db
								.query("characters")
								.withIndex("by_hardcore_level", (q) =>
									q.eq("hardcore", hardcore),
								)
								.order("desc")
								.take(50)
						: await ctx.db
								.query("characters")
								.withIndex("by_hardcore_bossKills", (q) =>
									q.eq("hardcore", hardcore),
								)
								.order("desc")
								.take(50)

				const entries = top.map((c) => ({
					characterId: c._id,
					characterName: c.name,
					classId: c.classId,
					level: c.level,
					xp: c.xp ?? 0,
					totalBossKills: c.totalBossKills ?? sumBossKills(c.bossKillCounts),
					hardcore: !!c.hardcore,
					dead: !!c.dead,
				}))

				const existing = await ctx.db
					.query("leaderboardSnapshot")
					.withIndex("by_category_mode", (q) =>
						q.eq("category", category).eq("mode", mode),
					)
					.unique()

				if (existing) {
					await ctx.db.patch(existing._id, { entries, updatedAt: Date.now() })
				} else {
					await ctx.db.insert("leaderboardSnapshot", {
						category,
						mode,
						entries,
						updatedAt: Date.now(),
					})
				}
			}
		}
	},
})

// One-shot migration to populate the new leaderboard index keys on legacy
// characters. Idempotent — safe to re-run. Run from the Convex dashboard
// once after the schema deploys, then this mutation can be deleted at the
// next cleanup pass.
//
// Backfills:
//   - `hardcore: false` where undefined (the leaderboard indexes can't match
//     a character whose `hardcore` field is missing entirely)
//   - `totalBossKills` from the existing `bossKillCounts` aggregate
export const backfillLeaderboardFields = internalMutation({
	handler: async (ctx) => {
		const all = await ctx.db.query("characters").collect()
		let patched = 0
		for (const char of all) {
			const patch: Record<string, unknown> = {}
			if (char.hardcore === undefined) patch.hardcore = false

			// Only seed totalBossKills when it's still undefined — once it's set,
			// `recordKill` is the source of truth (increments per boss kill).
			// The bossKillCounts source moved from characters → characterProgression,
			// so reach into progression first and fall back to the legacy field
			// for pre-split characters that haven't been touched yet.
			if (char.totalBossKills === undefined) {
				const progression = await ctx.db
					.query("characterProgression")
					.withIndex("by_characterId", (q) => q.eq("characterId", char._id))
					.unique()
				const counts = progression
					? progression.bossKillCounts
					: char.bossKillCounts
				patch.totalBossKills = sumBossKills(counts)
			}

			if (Object.keys(patch).length > 0) {
				await ctx.db.patch(char._id, patch)
				patched++
			}
		}
		return { scanned: all.length, patched }
	},
})

export const getSnapshot = query({
	args: {
		category: v.string(),
		mode: v.string(),
	},
	handler: async (ctx, args) => {
		return ctx.db
			.query("leaderboardSnapshot")
			.withIndex("by_category_mode", (q) =>
				q.eq("category", args.category).eq("mode", args.mode),
			)
			.unique()
	},
})
