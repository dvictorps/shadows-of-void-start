import { ConvexError, v } from "convex/values"
import type { QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import { authComponent } from "./auth"

async function getRoleRecord(ctx: QueryCtx, authUserId: string) {
	return ctx.db
		.query("userRoles")
		.withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
		.unique()
}

/**
 * Returns the current user's role. Defaults to "user" if no record exists.
 */
export const getUserRole = query({
	args: {},
	handler: async (ctx) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) return null

		const roleRecord = await getRoleRecord(ctx, authUser._id)

		return {
			role: roleRecord?.role ?? "user",
			name: authUser.name,
			email: authUser.email,
		}
	},
})

/**
 * Returns true if the current user is an admin.
 */
export const isAdmin = query({
	args: {},
	handler: async (ctx) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) return false

		const roleRecord = await getRoleRecord(ctx, authUser._id)

		return roleRecord?.role === "admin"
	},
})

/**
 * Sets a user's role. Only callable by existing admins.
 * For bootstrapping the first admin, use Convex dashboard to insert directly.
 */
export const setUserRole = mutation({
	args: {
		authUserId: v.string(),
		role: v.union(v.literal("user"), v.literal("admin")),
	},
	handler: async (ctx, { authUserId, role }) => {
		// Check caller is admin
		const callerAuth = await authComponent.getAuthUser(ctx)
		if (!callerAuth) throw new ConvexError("Not authenticated")

		const callerRole = await getRoleRecord(ctx, callerAuth._id)

		if (callerRole?.role !== "admin") {
			throw new ConvexError("Only admins can change roles")
		}

		// Upsert target user's role
		const existing = await getRoleRecord(ctx, authUserId)

		if (existing) {
			await ctx.db.patch(existing._id, { role })
		} else {
			await ctx.db.insert("userRoles", { authUserId, role })
		}
	},
})
