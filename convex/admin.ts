// ─────────────────────────────────────────────────────────────────────────────
//  Admin-only queries powering /admin. Every endpoint starts with
//  `assertAdmin(ctx)` — the route-level `beforeLoad` is a UX guard, not a
//  security boundary, because a hostile client can hit Convex endpoints
//  directly. Mutations that change role state live in `users.ts` so they
//  sit next to `assertAdmin` and the existing role-record helpers.
// ─────────────────────────────────────────────────────────────────────────────

import { v } from "convex/values"
import { components } from "./_generated/api"
import { query } from "./_generated/server"
import { authComponent } from "./auth"
import { assertAdmin } from "./users"

interface AuthUserDoc {
	_id: string
	_creationTime: number
	name: string
	email: string
	emailVerified: boolean
	createdAt: number
	image?: string | null
}

/**
 * Pulls one page of every auth user (numItems: 200 — generous ceiling for
 * the friends/beta phase). If the friend list ever exceeds this, swap the
 * list page to `usePaginatedQuery` instead of cranking the limit.
 */
async function listAllUsers(ctx: Parameters<typeof assertAdmin>[0]): Promise<AuthUserDoc[]> {
	const result = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
		model: "user",
		paginationOpts: { numItems: 200, cursor: null },
		sortBy: { field: "createdAt", direction: "desc" },
	})) as { page: AuthUserDoc[]; isDone: boolean; continueCursor: string }
	return result.page
}

/**
 * Top-of-page metrics. Cheap aggregations over the small tables (`characters`,
 * `userRoles`) and a single page of users — explicit `.collect()` on
 * `characters` is fine while it stays in friends-beta range. If `characters`
 * grows past a few thousand, swap to a denormalized counter pattern.
 */
export const pulse = query({
	args: {},
	handler: async (ctx) => {
		await assertAdmin(ctx)

		const [users, characters, roles] = await Promise.all([
			listAllUsers(ctx),
			ctx.db.query("characters").collect(),
			ctx.db.query("userRoles").collect(),
		])

		const adminCount = roles.filter((r) => r.role === "admin").length
		const hardcoreCount = characters.filter((c) => c.hardcore === true).length
		const softcoreCount = characters.length - hardcoreCount

		return {
			userCount: users.length,
			characterCount: characters.length,
			adminCount,
			hardcoreCount,
			softcoreCount,
		}
	},
})

/**
 * Joined user listing for the dashboard. Returns one row per auth user with
 * their role + character count denormalized so the UI doesn't need N+1
 * queries. Sorted newest-first via the adapter `sortBy`.
 */
export const listUsers = query({
	args: {},
	handler: async (ctx) => {
		await assertAdmin(ctx)

		const [users, roles, characters] = await Promise.all([
			listAllUsers(ctx),
			ctx.db.query("userRoles").collect(),
			ctx.db.query("characters").collect(),
		])

		const roleByUser = new Map(roles.map((r) => [r.authUserId, r.role]))
		const charsByUser = new Map<string, number>()
		for (const c of characters) {
			charsByUser.set(c.authUserId, (charsByUser.get(c.authUserId) ?? 0) + 1)
		}

		return users.map((u) => ({
			authUserId: u._id,
			name: u.name,
			email: u.email,
			emailVerified: u.emailVerified,
			createdAt: u.createdAt,
			role: roleByUser.get(u._id) ?? ("user" as const),
			characterCount: charsByUser.get(u._id) ?? 0,
		}))
	},
})

/**
 * Slim listing of just the admins. Powers the dedicated admins table, which
 * is the surface that mutates permissions. Includes `joinedAt` so the table
 * can show how long someone has held the role (admin records are inserted
 * on promotion — `_creationTime` is the promotion time, NOT the user's
 * signup time).
 */
export const listAdmins = query({
	args: {},
	handler: async (ctx) => {
		await assertAdmin(ctx)

		const roles = await ctx.db
			.query("userRoles")
			.collect()
		const admins = roles.filter((r) => r.role === "admin")

		const enriched = await Promise.all(
			admins.map(async (r) => {
				const user = await authComponent.getAnyUserById(ctx, r.authUserId)
				if (!user) return null
				return {
					authUserId: r.authUserId,
					name: user.name,
					email: user.email,
					grantedAt: r._creationTime,
				}
			}),
		)
		return enriched.flatMap((row) => (row ? [row] : []))
	},
})

/**
 * Drill-down for the users table. Returns the characters owned by a given
 * auth user — raw classId is included so the client renders the display
 * name via paraglide (same convention as the character-select roster).
 */
export const listCharactersForUser = query({
	args: { authUserId: v.string() },
	handler: async (ctx, { authUserId }) => {
		await assertAdmin(ctx)

		const docs = await ctx.db
			.query("characters")
			.withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
			.order("desc")
			.collect()

		return docs.map((c) => ({
			_id: c._id,
			name: c.name,
			classId: c.classId,
			level: c.level,
			hardcore: c.hardcore ?? false,
			currentLocation: c.currentLocation ?? "city",
			createdAt: c.createdAt,
		}))
	},
})
