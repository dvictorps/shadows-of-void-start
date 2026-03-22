// ── Equipment slots ──

export const EQUIPMENT_TYPES = {
	weapon: { id: "weapon", name: "Weapon", slot: "mainHand" },
	offhand: { id: "offhand", name: "Off-hand", slot: "offHand" },
	helmet: { id: "helmet", name: "Helmet", slot: "head" },
	chestplate: { id: "chestplate", name: "Chestplate", slot: "chest" },
	leggings: { id: "leggings", name: "Leggings", slot: "legs" },
	boots: { id: "boots", name: "Boots", slot: "feet" },
	gloves: { id: "gloves", name: "Gloves", slot: "hands" },
	ring: { id: "ring", name: "Ring", slot: "ring" },
	amulet: { id: "amulet", name: "Amulet", slot: "neck" },
	belt: { id: "belt", name: "Belt", slot: "waist" },
} as const

export type EquipmentType = keyof typeof EQUIPMENT_TYPES

// ── Weapon subtypes ──

export const WEAPON_TYPES = {
	sword: { id: "sword", name: "Sword", damageType: "physical", attackSpeed: "medium", twoHanded: false },
	greatsword: { id: "greatsword", name: "Greatsword", damageType: "physical", attackSpeed: "slow", twoHanded: true },
	dagger: { id: "dagger", name: "Dagger", damageType: "physical", attackSpeed: "fast", twoHanded: false },
	bow: { id: "bow", name: "Bow", damageType: "physical", attackSpeed: "medium", twoHanded: true },
	staff: { id: "staff", name: "Staff", damageType: "magic", attackSpeed: "medium", twoHanded: true },
	wand: { id: "wand", name: "Wand", damageType: "magic", attackSpeed: "fast", twoHanded: false },
	axe: { id: "axe", name: "Axe", damageType: "physical", attackSpeed: "medium", twoHanded: false },
	mace: { id: "mace", name: "Mace", damageType: "physical", attackSpeed: "slow", twoHanded: false },
	twoHandedAxe: { id: "twoHandedAxe", name: "Two-Handed Axe", damageType: "physical", attackSpeed: "slow", twoHanded: true },
} as const

export type WeaponType = keyof typeof WEAPON_TYPES

// ── Attack weapon subtypes (excludes spell weapons: staff/wand) ──

export const ATTACK_WEAPON_TYPES = ["sword", "greatsword", "dagger", "bow", "axe", "mace", "twoHandedAxe"] as const satisfies readonly WeaponType[]

// ── Armor subtypes ──

export const ARMOR_TYPES = {
	silk: { id: "silk", name: "Silk", baseDefense: "barrier", allowedSlots: ["helmet", "chestplate", "leggings", "boots", "gloves"] },
	leather: { id: "leather", name: "Leather", baseDefense: "evasion", allowedSlots: ["helmet", "chestplate", "leggings", "boots", "gloves"] },
	plate: { id: "plate", name: "Plate", baseDefense: "armor", allowedSlots: ["helmet", "chestplate", "leggings", "boots", "gloves"] },
} as const

export type ArmorType = keyof typeof ARMOR_TYPES

// ── Damage elements ──

export const DAMAGE_ELEMENTS = {
	physical: "physical",
	cold: "cold",
	fire: "fire",
	lightning: "lightning",
	void: "void",
} as const

export type DamageElement = (typeof DAMAGE_ELEMENTS)[keyof typeof DAMAGE_ELEMENTS]

// ── Valid base stat keys ──

export type BaseStatKey = "minDamage" | "maxDamage" | "attackSpeed" | "criticalChance" | "armor" | "evasion" | "barrier" | "blockChance"

// ── Equipment groups (single source of truth for applicableTo) ──

export const EQUIPMENT_GROUPS = {
	allArmor: ["helmet", "chestplate", "leggings", "boots", "gloves"] as const,
	allJewelry: ["ring", "amulet", "belt"] as const,
	allAttackWeapons: ATTACK_WEAPON_TYPES,
} as const

export type EquipmentGroup = keyof typeof EQUIPMENT_GROUPS

// ── Modifier target (union of equipment type + weapon subtype + group) ──

export type ModifierApplicableTo = EquipmentType | WeaponType | EquipmentGroup
