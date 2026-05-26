import { v } from "convex/values"
import { internalMutation, query } from "./_generated/server"

function sumBossKills(counts: unknown): number {
	if (!counts || typeof counts !== "object") return 0
	return Object.values(counts as Record<string, number>).reduce(
		(sum, n) => sum + (typeof n === "number" ? n : 0),
		0,
	)
}

export const computeSnapshot = internalMutation({
	handler: async (ctx) => {
		const allCharacters = await ctx.db.query("characters").collect()

		const categories = ["level", "bossKills"] as const
		const modes = ["softcore", "hardcore"] as const

		for (const category of categories) {
			for (const mode of modes) {
				const filtered = allCharacters.filter((c) =>
					mode === "hardcore" ? !!c.hardcore : !c.hardcore,
				)

				const sorted = [...filtered].sort((a, b) => {
					if (category === "level") {
						if (b.level !== a.level) return b.level - a.level
						return (b.xp ?? 0) - (a.xp ?? 0)
					}
					return sumBossKills(b.bossKillCounts) - sumBossKills(a.bossKillCounts)
				})

				const entries = sorted.slice(0, 50).map((c) => ({
					characterId: c._id,
					characterName: c.name,
					classId: c.classId,
					level: c.level,
					xp: c.xp ?? 0,
					totalBossKills: sumBossKills(c.bossKillCounts),
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
