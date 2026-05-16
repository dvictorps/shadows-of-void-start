import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
	userRoles: defineTable({
		authUserId: v.string(),
		role: v.union(v.literal("user"), v.literal("admin")),
	}).index("by_authUserId", ["authUserId"]),

	characters: defineTable({
		authUserId: v.string(),
		name: v.string(),
		// Validated against CLASS_DEFINITIONS in src/game/classes/data at write time.
		// Stored as string so adding a class only requires updating game data.
		classId: v.string(),
		level: v.number(),
		createdAt: v.number(),
	}).index("by_authUserId", ["authUserId"]),
})
