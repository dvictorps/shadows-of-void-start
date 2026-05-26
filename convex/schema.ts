import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"
import { generatedItemValidator } from "./itemValidator"

export default defineSchema({
	userRoles: defineTable({
		authUserId: v.string(),
		role: v.union(v.literal("user"), v.literal("admin")),
	})
		.index("by_authUserId", ["authUserId"])
		// Used by the admin dashboard's `listAdmins` to scan admins without
		// fanning out across every userRole row.
		.index("by_role", ["role"]),

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
		// Active player input — see CONTEXT.md → Active player input.
		// Drop-only (~2-3% per kill, independent roll). Uncapped supply.
		// Triggers the camp cinematic on demand during exploração / combate.
		etherealIncense: v.optional(v.number()),
		// Set of node ids the player has visited at least once (arrived at via
		// any travel mechanic). Wind crystals can only jump to nodes in this
		// list. Persisted append-only; respawn doesn't clear it.
		unlockedNodes: v.optional(v.array(v.string())),
		// Zone progression — see CONTEXT.md → Zone states + Progression gating.
		// `completedZones` is append-only: a node enters once the player kills
		// its rare miniboss. Drives the travel-gate check.
		completedZones: v.optional(v.array(v.string())),
		// Threshold counter for the current visit. Increments on each kill,
		// fills at 30, resets to 0 on miniboss kill OR on leaving the zone
		// with the miniboss unsummoned.
		currentZoneKills: v.optional(v.number()),
		// Server-authoritative camp/phase derivation — see docs/plans/in-progress.md
		// "Server-authoritative camp/phase derivation". Set on enterZone, consumed
		// by enterCamp / exitCamp, cleared on exitZone / death.
		// `zoneStartedAt` is the wall-clock ms timestamp when enterZone fired —
		// enterCamp gates `Date.now() - zoneStartedAt >= campThresholdsMs[i]`.
		zoneStartedAt: v.optional(v.number()),
		// `campThresholdsMs` is the array of cumulative ms thresholds rolled by
		// enterZone (from the zone's encounterPlan). Each entry corresponds to
		// one camp the player can claim by calling enterCamp(thresholdIndex).
		campThresholdsMs: v.optional(v.array(v.number())),
		// `inCamp` is the authoritative phase flag — exitZone / pickFromBag /
		// discardFromBag derive their `phase` from this server-side so a
		// tampered client can't widen its retention share.
		inCamp: v.optional(v.boolean()),
		// Highest camp threshold index consumed so far in the current visit.
		// enterCamp rejects indices ≤ this so a player can't exit camp and
		// re-claim an earlier threshold (each one would still pass the
		// elapsed-time gate, and inCamp would flip back to true on every
		// replay). Reset on enterZone / exitZone / death / miniboss kill via
		// clearPerVisitZoneState (and explicitly in the miniboss reroll path).
		lastCampIndex: v.optional(v.number()),
		// Single active session per character — closes Threat #5 in
		// docs/security/threat-model.md. Every state-mutating mutation
		// validates `args.sessionToken === char.activeSessionToken` so a
		// second tab/device that claimed the character bumps the first
		// tab into a "session lost" modal on its next write. Read-only
		// queries deliberately ignore this field so a stale tab can still
		// observe coherent character state. `activeSessionAt` is kept for
		// observability (admin debug, future race-window heuristics);
		// the current modal trigger uses simple first-rejection.
		activeSessionToken: v.optional(v.string()),
		activeSessionAt: v.optional(v.number()),
		// Barrier current value — persisted so it survives zone exits and map
		// transitions. Synced alongside hpCurrent by the combat loop's periodic
		// write-back. City entry resets to maxBarrier.
		barrierCurrent: v.optional(v.number()),
		// Mage elemental attunement — see CONTEXT.md → Elemental Attunement.
		selectedElement: v.optional(
			v.union(v.literal("fire"), v.literal("cold"), v.literal("lightning")),
		),
		lastElementSwitchAt: v.optional(v.number()),
		// Boss kill counters — keyed by boss id (e.g., { gralfor: 12 }).
		bossKillCounts: v.optional(v.any()),
		// Hardcore death — soft-delete for leaderboard "Fallen Heroes".
		dead: v.optional(v.boolean()),
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
		// Stash grid position (0..59) when locationKind === "stash".
		stashSlot: v.optional(v.number()),
	})
		.index("by_character_kind", ["characterId", "locationKind"])
		.index("by_zoneSession", ["zoneSession"])
		.index("by_stash", ["authUserId", "stashMode"]),

	leaderboardSnapshot: defineTable({
		category: v.string(),
		mode: v.string(),
		entries: v.array(
			v.object({
				characterId: v.string(),
				characterName: v.string(),
				classId: v.string(),
				level: v.number(),
				xp: v.number(),
				totalBossKills: v.number(),
				hardcore: v.boolean(),
				dead: v.boolean(),
			}),
		),
		updatedAt: v.number(),
	}).index("by_category_mode", ["category", "mode"]),
})
