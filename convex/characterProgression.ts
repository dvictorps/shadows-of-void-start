import { v } from "convex/values"
import { query } from "./_generated/server"
import { authComponent } from "./auth"

// Subscription target for the world map / boss screens. Returns null when
// no progression doc exists yet — clients fall back to the legacy character
// fields (`character.unlockedNodes` / `completedZones` / `bossKillCounts`)
// until the first mutation seeds the progression doc.
//
// Ownership: this is a `characterId`-keyed lookup, but the underlying
// `unlockedNodes` etc. were always client-visible on the character doc, so
// we mirror that exposure rather than gating behind a per-character ACL
// check. The legacy `byId` query already enforces "this is your character
// or null" at the auth-user level.
export const byCharacterId = query({
	args: { characterId: v.id("characters") },
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) return null
		const char = await ctx.db.get(args.characterId)
		if (!char || char.authUserId !== authUser._id) return null
		return ctx.db
			.query("characterProgression")
			.withIndex("by_characterId", (q) =>
				q.eq("characterId", args.characterId),
			)
			.unique()
	},
})
