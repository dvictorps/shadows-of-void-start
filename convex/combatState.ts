import { v } from "convex/values"
import { query } from "./_generated/server"
import { authComponent } from "./auth"

export const byCharacterId = query({
	args: { characterId: v.id("characters") },
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) return null
		return ctx.db
			.query("combatState")
			.withIndex("by_characterId", (q) => q.eq("characterId", args.characterId))
			.unique()
	},
})
