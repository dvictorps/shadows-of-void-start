import { ConvexError, v } from "convex/values"
import { CLASS_DEFINITIONS } from "../src/game/classes/data"
import { mutation, query } from "./_generated/server"
import { authComponent } from "./auth"

const MAX_CHARACTERS_PER_USER = 8
const MAX_NAME_LENGTH = 20

function isKnownClassId(id: string): boolean {
	return Object.hasOwn(CLASS_DEFINITIONS, id)
}

/**
 * Returns all characters owned by the current user, newest first.
 * Returns an empty array if unauthenticated.
 */
export const list = query({
	args: {},
	handler: async (ctx) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) return []
		return await ctx.db
			.query("characters")
			.withIndex("by_authUserId", (q) => q.eq("authUserId", authUser._id))
			.order("desc")
			.collect()
	},
})

/**
 * Creates a character for the current user. Enforces:
 *  - Authenticated user
 *  - Name 1-20 characters after trimming
 *  - classId is a known class in game data (single source of truth in src/game/classes/data)
 *  - No duplicate name (case-insensitive) within this user's roster
 *  - Max 8 characters per user
 *
 * Returns the new character's id.
 */
export const create = mutation({
	args: {
		name: v.string(),
		classId: v.string(),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")

		if (!isKnownClassId(args.classId)) {
			throw new ConvexError(`Unknown class: ${args.classId}`)
		}

		const name = args.name.trim()
		if (name.length === 0) throw new ConvexError("Name cannot be empty")
		if (name.length > MAX_NAME_LENGTH)
			throw new ConvexError(`Name must be at most ${MAX_NAME_LENGTH} characters`)

		const existing = await ctx.db
			.query("characters")
			.withIndex("by_authUserId", (q) => q.eq("authUserId", authUser._id))
			.collect()

		if (existing.length >= MAX_CHARACTERS_PER_USER) {
			throw new ConvexError(
				`Max ${MAX_CHARACTERS_PER_USER} characters per account`,
			)
		}

		const nameLower = name.toLowerCase()
		if (existing.some((c) => c.name.toLowerCase() === nameLower)) {
			throw new ConvexError("You already have a character with this name")
		}

		return await ctx.db.insert("characters", {
			authUserId: authUser._id,
			name,
			classId: args.classId,
			level: 1,
			createdAt: Date.now(),
		})
	},
})

/**
 * Deletes a character owned by the current user.
 */
export const remove = mutation({
	args: { id: v.id("characters") },
	handler: async (ctx, args) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")

		const char = await ctx.db.get(args.id)
		if (!char) throw new ConvexError("Character not found")
		if (char.authUserId !== authUser._id)
			throw new ConvexError("Not your character")

		await ctx.db.delete(args.id)
	},
})
