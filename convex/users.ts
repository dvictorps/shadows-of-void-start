import { ConvexError, v } from "convex/values"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { internalMutation, mutation, query } from "./_generated/server"
import { authComponent } from "./auth"

async function getRoleRecord(ctx: QueryCtx, authUserId: string) {
	return ctx.db
		.query("userRoles")
		.withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
		.unique()
}

// Bumps the per-user character counters on `userRoles`. Creates the row with
// `role: "user"` if absent — so the table doubles as the user-metrics index
// the admin dashboard reads in a single collect. `delta` is +1 for create,
// -1 for remove. `hardcoreDelta` mirrors the total but only when the
// character is hardcore.
export async function adjustUserCharacterMetrics(
	ctx: MutationCtx,
	authUserId: string,
	delta: number,
	hardcoreDelta: number,
): Promise<void> {
	const existing = await ctx.db
		.query("userRoles")
		.withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
		.unique()
	if (existing) {
		const nextTotal = Math.max(0, (existing.characterCount ?? 0) + delta)
		const nextHardcore = Math.max(
			0,
			(existing.hardcoreCount ?? 0) + hardcoreDelta,
		)
		await ctx.db.patch(existing._id, {
			characterCount: nextTotal,
			hardcoreCount: nextHardcore,
		})
	} else {
		await ctx.db.insert("userRoles", {
			authUserId,
			role: "user",
			characterCount: Math.max(0, delta),
			hardcoreCount: Math.max(0, hardcoreDelta),
		})
	}
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

// One-shot migration. Walks every character, groups by authUserId, and
// writes the (characterCount, hardcoreCount) totals onto the matching
// userRoles row (creating one with role "user" where missing). Idempotent
// — safe to re-run. Invoke from the Convex dashboard after deploy; delete
// this mutation at the next cleanup pass.
export const backfillUserMetrics = internalMutation({
	handler: async (ctx) => {
		const allChars = await ctx.db.query("characters").collect()
		const byUser = new Map<
			string,
			{ total: number; hardcore: number }
		>()
		for (const char of allChars) {
			const entry = byUser.get(char.authUserId) ?? { total: 0, hardcore: 0 }
			entry.total += 1
			if (char.hardcore === true) entry.hardcore += 1
			byUser.set(char.authUserId, entry)
		}

		let patched = 0
		let created = 0
		for (const [authUserId, counts] of byUser) {
			const existing = await ctx.db
				.query("userRoles")
				.withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
				.unique()
			if (existing) {
				const totalMatches = existing.characterCount === counts.total
				const hcMatches = existing.hardcoreCount === counts.hardcore
				if (!totalMatches || !hcMatches) {
					await ctx.db.patch(existing._id, {
						characterCount: counts.total,
						hardcoreCount: counts.hardcore,
					})
					patched++
				}
			} else {
				await ctx.db.insert("userRoles", {
					authUserId,
					role: "user",
					characterCount: counts.total,
					hardcoreCount: counts.hardcore,
				})
				created++
			}
		}

		return {
			characters: allChars.length,
			usersWithChars: byUser.size,
			patched,
			created,
		}
	},
})
