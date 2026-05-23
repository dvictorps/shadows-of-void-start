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
 * Server-side admin gate. Every admin-only query/mutation MUST start with
 * this — the route-level `beforeLoad` check is a UX guard, not a security
 * boundary. A hostile client can hit Convex endpoints directly.
 *
 * Returns the auth user record on success so callers can identify the admin
 * (e.g. for "cannot revoke yourself" checks) without an extra round-trip.
 */
export async function assertAdmin(ctx: QueryCtx) {
	const authUser = await authComponent.getAuthUser(ctx)
	if (!authUser) throw new ConvexError("Not authenticated")
	const roleRecord = await getRoleRecord(ctx, authUser._id)
	if (roleRecord?.role !== "admin") {
		throw new ConvexError("Admin access required")
	}
	return authUser
}

/**
 * Returns the current user's role + identity. Defaults to "user" if no role
 * record exists. `authUserId` lets the admin dashboard identify the caller's
 * own row so it can disable revoke-self at the UI layer (server also blocks
 * it via `setUserRole`).
 */
export const getUserRole = query({
	args: {},
	handler: async (ctx) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) return null

		const roleRecord = await getRoleRecord(ctx, authUser._id)

		return {
			authUserId: authUser._id,
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
 * Sets a user's role. Only callable by existing admins. Guards against:
 *  - non-admin callers (assertAdmin)
 *  - revoking your own admin (prevents accidental lockout — the dashboard's
 *    admins table also disables this row's revoke button, but the server is
 *    the actual fence)
 *  - assigning a role to a non-existent auth user (keeps userRoles clean)
 *
 * For bootstrapping the first admin, use the Convex dashboard to insert
 * directly into `userRoles`.
 */
export const setUserRole = mutation({
	args: {
		authUserId: v.string(),
		role: v.union(v.literal("user"), v.literal("admin")),
	},
	handler: async (ctx, { authUserId, role }) => {
		const caller = await assertAdmin(ctx)

		if (caller._id === authUserId && role !== "admin") {
			throw new ConvexError("Cannot revoke your own admin role")
		}

		const target = await authComponent.getAnyUserById(ctx, authUserId)
		if (!target) throw new ConvexError("User not found")

		const existing = await getRoleRecord(ctx, authUserId)

		if (existing) {
			await ctx.db.patch(existing._id, { role })
		} else {
			await ctx.db.insert("userRoles", { authUserId, role })
		}
	},
})
