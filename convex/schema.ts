import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"
import { generatedItemValidator } from "./itemValidator"

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
		// Denormalized pointer to the equipped weapon's items-table Doc.
		// The items table is the source of truth; this is a cached id for fast
		// "what weapon does this character have" lookups.
		equippedWeaponId: v.optional(v.id("items")),
		// Active zone session id (nanoid). Set on enterZone, cleared on exitZone or death.
		// Items in items table with location.zoneSession === this value belong to the bag.
		currentZoneSession: v.optional(v.string()),
		// Travel state — see CONTEXT.md → Travel system.
		// `currentLocation` is the node the character is "at". Defaults to "city"
		// at character creation; set on travel arrival; reset to "city" on respawn.
		currentLocation: v.optional(v.string()),
		// `travelDestination`, `travelStartedAt`, `travelArrivesAt` are set together
		// when a travel starts and cleared together on arrival. All undefined =
		// not traveling. `currentLocation` is intentionally kept pointing at the
		// source node during transit — the "you are here" pin stays where the
		// player departed from until arrival commits.
		travelDestination: v.optional(v.string()),
		travelStartedAt: v.optional(v.number()),
		travelArrivesAt: v.optional(v.number()),
		// Currency — see CONTEXT.md → Ruby. Earned by selling gear at the vendor;
		// spent on consumables and (future) stash tabs. Monsters never drop Rubys.
		rubys: v.optional(v.number()),
		// Travel consumables (see CONTEXT.md → Travel consumables).
		// Caps enforced server-side at purchase time.
		teleportStones: v.optional(v.number()),
		windCrystals: v.optional(v.number()),
		// Set of node ids the player has visited at least once (arrived at via
		// any travel mechanic). Wind crystals can only jump to nodes in this
		// list. Persisted append-only; respawn doesn't clear it.
		unlockedNodes: v.optional(v.array(v.string())),
	}).index("by_authUserId", ["authUserId"]),

	// All items live here — drops, inventory, equipped, stash. Location is
	// expressed via the `locationKind` discriminator plus a handful of optional
	// denormalized fields (Convex doesn't index into union-object members).
	// Item ids stay stable across the lifecycle (drop → bag → inventory →
	// equipped → stash → future trade), which is the foundation for ranking
	// and trade integrity.
	items: defineTable({
		authUserId: v.string(),
		locationKind: v.union(
			v.literal("zoneBag"),
			v.literal("inventory"),
			v.literal("equipped"),
			v.literal("stash"),
		),
		// zoneBag / inventory / equipped: which character owns this item right now
		characterId: v.optional(v.id("characters")),
		// zoneBag only: which session of which zone — used to wipe on death/commit
		zoneSession: v.optional(v.string()),
		// equipped only: which slot the item occupies
		equippedSlot: v.optional(
			v.union(
				v.literal("weapon"),
				v.literal("offhand"),
				v.literal("helmet"),
				v.literal("chestplate"),
				v.literal("boots"),
				v.literal("gloves"),
				v.literal("amulet"),
				v.literal("belt"),
				v.literal("ring1"),
				v.literal("ring2"),
			),
		),
		// stash only: which mode-scoped stash the item lives in
		stashMode: v.optional(
			v.union(v.literal("softcore"), v.literal("hardcore")),
		),
		data: generatedItemValidator,
		droppedAt: v.number(),
		// Where the drop came from — monster id, "starter", "vendor". Telemetry / future audit.
		droppedFrom: v.optional(v.string()),
		droppedFromLevel: v.optional(v.number()),
		// Inventory grid position (0..59) when locationKind === "inventory".
		// Player can drag-reorder. Empty slots are just absence of an item.
		inventorySlot: v.optional(v.number()),
	})
		.index("by_character_kind", ["characterId", "locationKind"])
		.index("by_zoneSession", ["zoneSession"])
		.index("by_stash", ["authUserId", "stashMode"]),
})
