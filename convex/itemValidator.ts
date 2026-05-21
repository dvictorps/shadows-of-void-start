import { v } from "convex/values"

// Convex validator mirroring the GeneratedItem TypeScript type. Kept in sync
// with src/game/items/types/item.ts by hand — Convex can't infer from TS.
//
// Used by the `items.data` field. Server is the only writer (rolled drops),
// so this validator catches developer mistakes more than untrusted input.

const rolledImplicit = v.object({
	// Optional — items rolled before implicits were wired into the stat engine
	// don't carry an id. They stay display-only on read.
	modifierId: v.optional(v.string()),
	description: v.string(),
	value: v.number(),
})

const rolledMod = v.object({
	modifierId: v.string(),
	modifierName: v.string(),
	affixType: v.union(v.literal("prefix"), v.literal("suffix")),
	modifierType: v.string(),
	isGlobalStat: v.boolean(),
	tier: v.number(),
	value: v.number(),
	minValue: v.optional(v.number()),
	maxValue: v.optional(v.number()),
	description: v.string(),
})

const elementalDamageEntry = v.object({
	element: v.string(),
	min: v.number(),
	max: v.number(),
})

const computedWeaponStats = v.object({
	physicalDamage: v.object({ min: v.number(), max: v.number() }),
	elementalDamage: v.array(elementalDamageEntry),
	attackSpeed: v.number(),
	criticalChance: v.number(),
})

const computedDefenseStats = v.object({
	armor: v.optional(v.number()),
	evasion: v.optional(v.number()),
	barrier: v.optional(v.number()),
	blockChance: v.optional(v.number()),
})

const baseStats = v.object({
	minDamage: v.optional(v.number()),
	maxDamage: v.optional(v.number()),
	attackSpeed: v.optional(v.number()),
	criticalChance: v.optional(v.number()),
	armor: v.optional(v.number()),
	evasion: v.optional(v.number()),
	barrier: v.optional(v.number()),
	blockChance: v.optional(v.number()),
})

const requirements = v.object({
	level: v.number(),
	str: v.optional(v.number()),
	dex: v.optional(v.number()),
	int: v.optional(v.number()),
})

const equipmentTypeValidator = v.union(
	v.literal("weapon"),
	v.literal("offhand"),
	v.literal("tome"),
	v.literal("quiver"),
	v.literal("helmet"),
	v.literal("chestplate"),
	v.literal("boots"),
	v.literal("gloves"),
	v.literal("ring"),
	v.literal("amulet"),
	v.literal("belt"),
)

const weaponTypeValidator = v.union(
	v.literal("sword"),
	v.literal("greatsword"),
	v.literal("dagger"),
	v.literal("bow"),
	v.literal("staff"),
	v.literal("wand"),
	v.literal("axe"),
	v.literal("mace"),
	v.literal("twoHandedAxe"),
)

const armorTypeValidator = v.union(
	v.literal("silk"),
	v.literal("leather"),
	v.literal("plate"),
)

export const generatedItemValidator = v.object({
	id: v.string(),
	templateId: v.string(),
	templateName: v.string(),
	equipmentType: equipmentTypeValidator,
	weaponType: v.optional(weaponTypeValidator),
	armorType: v.optional(armorTypeValidator),
	rarity: v.union(
		v.literal("normal"),
		v.literal("magic"),
		v.literal("rare"),
		v.literal("legendary"),
		v.literal("epic"),
	),
	name: v.string(),
	itemLevel: v.number(),
	baseStats,
	implicits: v.array(rolledImplicit),
	explicits: v.array(rolledMod),
	computedStats: v.optional(computedWeaponStats),
	computedDefenseStats: v.optional(computedDefenseStats),
	requirements: v.optional(requirements),
})
