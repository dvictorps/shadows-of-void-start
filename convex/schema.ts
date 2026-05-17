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
		// Combat state — optional so pre-combat-feat characters validate; reads normalize via defaults.
		xp: v.optional(v.number()),
		hpCurrent: v.optional(v.number()),
		potions: v.optional(v.number()),
		hardcore: v.optional(v.boolean()),
		// Equipped gear references a starter-item id (e.g. "starter:rusty_sword") or, later,
		// a generated-item document id. Per-slot fields keep updates targeted.
		equippedWeapon: v.optional(v.string()),
	}).index("by_authUserId", ["authUserId"]),
})
