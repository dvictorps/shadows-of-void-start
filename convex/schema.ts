import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
	userRoles: defineTable({
		authUserId: v.string(),
		role: v.union(v.literal("user"), v.literal("admin")),
	}).index("by_authUserId", ["authUserId"]),
})
