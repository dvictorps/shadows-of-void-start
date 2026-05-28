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
 * Top-of-page metrics. Aggregates over auth users + a single `userRoles`
 * collect — character counts are denormalized onto userRoles via
 * `adjustUserCharacterMetrics`, so this scales O(usersWithRoleRow) rather
 * than the previous O(users) fan-out over the characters table.
 */
export const pulse = query({
	args: {},
	handler: async (ctx) => {
		await assertAdmin(ctx)

		const [users, allRoles] = await Promise.all([
			listAllUsers(ctx),
			ctx.db.query("userRoles").collect(),
		])

		let characterCount = 0
		let hardcoreCount = 0
		let adminCount = 0
		for (const role of allRoles) {
			characterCount += role.characterCount ?? 0
			hardcoreCount += role.hardcoreCount ?? 0
			if (role.role === "admin") adminCount++
		}

		return {
			userCount: users.length,
			characterCount,
			adminCount,
			hardcoreCount,
			softcoreCount: characterCount - hardcoreCount,
		}
	},
})

/**
 * Joined user listing for the dashboard. Reads userRoles once and maps it
 * by authUserId — character counts come from the denormalized counter on
 * userRoles, so each user is O(1) (a single map lookup) rather than the
 * previous per-user characters collect.
 */
export const listUsers = query({
	args: {},
	handler: async (ctx) => {
		await assertAdmin(ctx)

		const [users, allRoles] = await Promise.all([
			listAllUsers(ctx),
			ctx.db.query("userRoles").collect(),
		])

		const roleByUser = new Map(allRoles.map((r) => [r.authUserId, r]))

		return users.map((u) => {
			const roleDoc = roleByUser.get(u._id)
			return {
				authUserId: u._id,
				name: u.name,
				email: u.email,
				emailVerified: u.emailVerified,
				createdAt: u.createdAt,
				role: roleDoc?.role ?? ("user" as const),
				characterCount: roleDoc?.characterCount ?? 0,
			}
		})
	},
})

/**
 * Slim listing of just the admins. Powers the dedicated admins table, which
 * is the surface that mutates permissions. Includes `grantedAt` so the table
 * can show how long someone has held the role (admin records are inserted
 * on promotion — `_creationTime` is the promotion time, NOT the user's
 * signup time).
 *
 * Filtered server-side via the `by_role` index so the scan size is bounded
 * by admin count, not total userRoles records.
 */
export const listAdmins = query({
	args: {},
	handler: async (ctx) => {
		await assertAdmin(ctx)

		const admins = await ctx.db
			.query("userRoles")
			.withIndex("by_role", (q) => q.eq("role", "admin"))
			.collect()

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
