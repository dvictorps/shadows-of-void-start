import { describe, it, expect } from "vitest"
import { generateItem, getSynergyWeight } from "./generator"
import { MODIFIERS, type ModifierId } from "./data/modifiers"
import type { GeneratedItem, ItemRarity } from "./types"

// ── Helpers ──

function generateMany(count: number, opts: { rarity: ItemRarity; templateId?: string; itemLevel?: number }): GeneratedItem[] {
	return Array.from({ length: count }, () => generateItem(opts))
}

function allExplicitModIds(items: GeneratedItem[]): Set<string> {
	const ids = new Set<string>()
	for (const item of items) {
		for (const mod of item.explicits) ids.add(mod.modifierId)
	}
	return ids
}

const ATTACK_WEAPON_IDS = ["iron_sword", "iron_greatsword", "iron_dagger", "oak_bow", "iron_axe", "iron_mace", "iron_greataxe"]
const SPELL_WEAPON_IDS = ["apprentice_staff", "apprentice_wand"]
const JEWELRY_IDS = [
	"cobalt_ring", "garnet_ring", "topaz_ring", "obsidian_ring", "coral_ring", "lapis_ring",
	"gold_amulet", "jade_amulet", "amber_amulet", "lapis_amulet",
	"leather_belt", "chain_belt", "studded_belt", "cloth_belt",
]

// ── Basic generation ──

describe("generateItem basics", () => {
	it("returns a valid item with all required fields", () => {
		const item = generateItem({ rarity: "rare", itemLevel: 50 })
		expect(item.id).toBeTruthy()
		expect(item.templateId).toBeTruthy()
		expect(item.templateName).toBeTruthy()
		expect(item.equipmentType).toBeTruthy()
		expect(item.rarity).toBe("rare")
		expect(item.itemLevel).toBe(50)
		expect(item.baseStats).toBeDefined()
		expect(item.implicits).toBeDefined()
		expect(item.explicits).toBeDefined()
	})

	it("generates a normal item with 0 explicits", () => {
		const item = generateItem({ rarity: "normal", itemLevel: 50 })
		expect(item.explicits).toHaveLength(0)
	})

	it("uses specified templateId", () => {
		const item = generateItem({ rarity: "normal", templateId: "iron_sword" })
		expect(item.templateId).toBe("iron_sword")
		expect(item.templateName).toBe("Iron Sword")
	})

	it("falls back to random template when templateId is invalid", () => {
		const item = generateItem({ rarity: "normal", templateId: "nonexistent" })
		expect(item.templateId).toBeTruthy()
	})
})

// ── Mod counts per rarity ──

describe("mod counts per rarity", () => {
	it("magic items have 1-2 explicits", () => {
		const items = generateMany(100, { rarity: "magic", itemLevel: 80 })
		for (const item of items) {
			expect(item.explicits.length).toBeGreaterThanOrEqual(1)
			expect(item.explicits.length).toBeLessThanOrEqual(2)
		}
	})

	it("rare items have 3-4 explicits", () => {
		const items = generateMany(100, { rarity: "rare", itemLevel: 80 })
		for (const item of items) {
			expect(item.explicits.length).toBeGreaterThanOrEqual(3)
			expect(item.explicits.length).toBeLessThanOrEqual(4)
		}
	})

	it("legendary items have 5 explicits", () => {
		const items = generateMany(100, { rarity: "legendary", itemLevel: 80, templateId: "iron_sword" })
		for (const item of items) {
			expect(item.explicits.length).toBe(5)
		}
	})

	it("epic items have 6 explicits", () => {
		const items = generateMany(100, { rarity: "epic", itemLevel: 80, templateId: "iron_sword" })
		for (const item of items) {
			expect(item.explicits.length).toBe(6)
		}
	})
})

// ── Prefix / suffix limits ──

describe("prefix and suffix limits", () => {
	it("never exceeds 3 prefixes or 3 suffixes", () => {
		const items = generateMany(200, { rarity: "epic", itemLevel: 80 })
		for (const item of items) {
			const prefixes = item.explicits.filter((m) => m.affixType === "prefix").length
			const suffixes = item.explicits.filter((m) => m.affixType === "suffix").length
			expect(prefixes).toBeLessThanOrEqual(3)
			expect(suffixes).toBeLessThanOrEqual(3)
		}
	})

	it("magic items never exceed 2 prefixes or 2 suffixes", () => {
		const items = generateMany(200, { rarity: "magic", itemLevel: 80 })
		for (const item of items) {
			const prefixes = item.explicits.filter((m) => m.affixType === "prefix").length
			const suffixes = item.explicits.filter((m) => m.affixType === "suffix").length
			expect(prefixes).toBeLessThanOrEqual(2)
			expect(suffixes).toBeLessThanOrEqual(2)
		}
	})
})

// ── No duplicate mods ──

describe("no duplicate modifiers", () => {
	it("never rolls the same modifier twice on one item", () => {
		const items = generateMany(200, { rarity: "epic", itemLevel: 80 })
		for (const item of items) {
			const ids = item.explicits.map((m) => m.modifierId)
			expect(new Set(ids).size).toBe(ids.length)
		}
	})
})

// ── No decimals ──

describe("no decimal values", () => {
	it("all explicit mod values are integers", () => {
		const items = generateMany(200, { rarity: "epic", itemLevel: 80 })
		for (const item of items) {
			for (const mod of item.explicits) {
				expect(Number.isInteger(mod.value)).toBe(true)
			}
		}
	})

	it("all implicit values are integers", () => {
		const items = generateMany(200, { rarity: "rare", itemLevel: 80 })
		for (const item of items) {
			for (const mod of item.implicits) {
				expect(Number.isInteger(mod.value)).toBe(true)
			}
		}
	})

	it("descriptions contain no decimal points", () => {
		const items = generateMany(200, { rarity: "epic", itemLevel: 80 })
		for (const item of items) {
			for (const mod of item.explicits) {
				expect(mod.description).not.toMatch(/\d+\.\d+/)
			}
		}
	})
})

// ── RolledMod fields ──

describe("RolledMod carries modifierType and isGlobalStat", () => {
	it("every explicit has modifierType and isGlobalStat", () => {
		const items = generateMany(50, { rarity: "epic", itemLevel: 80 })
		for (const item of items) {
			for (const mod of item.explicits) {
				expect(["flat", "increased", "more"]).toContain(mod.modifierType)
				expect(typeof mod.isGlobalStat).toBe("boolean")
			}
		}
	})

	it("isGlobalStat matches the modifier definition", () => {
		const items = generateMany(50, { rarity: "epic", itemLevel: 80 })
		for (const item of items) {
			for (const mod of item.explicits) {
				const def = MODIFIERS[mod.modifierId as ModifierId]
				expect(mod.isGlobalStat).toBe(def.isGlobalStat ?? false)
			}
		}
	})
})

// ── Explicit ordering ──

describe("explicit ordering", () => {
	it("prefixes come before suffixes", () => {
		const items = generateMany(200, { rarity: "epic", itemLevel: 80 })
		for (const item of items) {
			let seenSuffix = false
			for (const mod of item.explicits) {
				if (mod.affixType === "suffix") seenSuffix = true
				if (mod.affixType === "prefix") expect(seenSuffix).toBe(false)
			}
		}
	})

	it("within same affix type, increased comes before flat", () => {
		const items = generateMany(200, { rarity: "epic", itemLevel: 80 })
		for (const item of items) {
			const prefixes = item.explicits.filter((m) => m.affixType === "prefix")
			const suffixes = item.explicits.filter((m) => m.affixType === "suffix")

			for (const group of [prefixes, suffixes]) {
				let seenFlat = false
				for (const mod of group) {
					if (mod.modifierType === "flat") seenFlat = true
					if (mod.modifierType === "increased") expect(seenFlat).toBe(false)
				}
			}
		}
	})
})

// ── Naming ──

describe("item naming", () => {
	it("normal items use template name", () => {
		const item = generateItem({ rarity: "normal", templateId: "iron_sword" })
		expect(item.name).toBe("Iron Sword")
	})

	it("magic items include affix names", () => {
		const items = generateMany(50, { rarity: "magic", templateId: "iron_sword", itemLevel: 80 })
		for (const item of items) {
			expect(item.name).toContain("Iron Sword")
		}
	})

	it("rare/legendary/epic items have generated names", () => {
		for (const rarity of ["rare", "legendary", "epic"] as ItemRarity[]) {
			const items = generateMany(20, { rarity, itemLevel: 80 })
			for (const item of items) {
				expect(item.name).not.toBe(item.templateName)
				expect(item.name.split(" ")).toHaveLength(2)
			}
		}
	})
})

// ── Spell weapons: no attack mods ──

describe("spell weapons (staff/wand)", () => {
	const LOCAL_ATTACK_MODS = [
		"physicalDamageFlat", "physicalDamageIncrease",
		"attackSpeedIncrease", "criticalChanceIncrease",
		"coldDamageToAttacksFlat", "fireDamageToAttacksFlat",
		"lightningDamageToAttacksFlat", "voidDamageToAttacksFlat",
		"accuracyFlat",
	]

	for (const templateId of SPELL_WEAPON_IDS) {
		it(`${templateId}: never rolls local attack mods`, () => {
			const items = generateMany(100, { rarity: "epic", templateId, itemLevel: 80 })
			const rolledIds = allExplicitModIds(items)
			for (const attackMod of LOCAL_ATTACK_MODS) {
				expect(rolledIds.has(attackMod)).toBe(false)
			}
		})

		it(`${templateId}: does not compute weapon stats`, () => {
			const items = generateMany(50, { rarity: "epic", templateId, itemLevel: 80 })
			for (const item of items) {
				expect(item.computedStats).toBeUndefined()
			}
		})

		it(`${templateId}: can roll spell damage flat mods`, () => {
			const items = generateMany(200, { rarity: "epic", templateId, itemLevel: 80 })
			const rolledIds = allExplicitModIds(items)
			const spellMods = ["coldDamageFlat", "fireDamageFlat", "lightningDamageFlat", "voidDamageFlat"]
			const hasAny = spellMods.some((id) => rolledIds.has(id))
			expect(hasAny).toBe(true)
		})
	}
})

// ── Attack weapons: compute weapon stats ──

describe("attack weapon computed stats", () => {
	it("computes physicalDamage with flat min/max added", () => {
		const items = generateMany(300, { rarity: "epic", templateId: "iron_sword", itemLevel: 80 })
		const withFlat = items.find((i) =>
			i.explicits.some((m) => m.modifierId === "physicalDamageFlat") && i.computedStats,
		)
		if (withFlat) {
			const flatMod = withFlat.explicits.find((m) => m.modifierId === "physicalDamageFlat")!
			expect(flatMod.minValue).toBeDefined()
			expect(flatMod.maxValue).toBeDefined()
			expect(withFlat.computedStats!.physicalDamage.min).toBeGreaterThanOrEqual(
				(withFlat.baseStats.minDamage ?? 0) + flatMod.minValue!,
			)
			expect(withFlat.computedStats!.physicalDamage.max).toBeGreaterThanOrEqual(
				(withFlat.baseStats.maxDamage ?? 0) + flatMod.maxValue!,
			)
		}
	})

	it("crit chance is increased (multiplicative), not flat additive", () => {
		const items = generateMany(300, { rarity: "epic", templateId: "iron_sword", itemLevel: 80 })
		const withCrit = items.find((i) =>
			i.explicits.some((m) => m.modifierId === "criticalChanceIncrease") &&
			!i.explicits.some((m) => m.modifierId === "physicalDamageFlat") &&
			i.computedStats,
		)
		if (withCrit) {
			const critMod = withCrit.explicits.find((m) => m.modifierId === "criticalChanceIncrease")!
			const base = withCrit.baseStats.criticalChance ?? 5
			const expected = Math.round(base * (1 + critMod.value / 100) * 10) / 10
			expect(withCrit.computedStats!.criticalChance).toBe(expected)
		}
	})

	it("attack weapons always have computedStats", () => {
		for (const templateId of ATTACK_WEAPON_IDS) {
			const item = generateItem({ rarity: "normal", templateId, itemLevel: 50 })
			expect(item.computedStats).toBeDefined()
		}
	})
})

// ── Armor: local defense mods ──

describe("armor local defense", () => {
	it("plate armor localDefenseFlat description says Armor, not Defense", () => {
		const items = generateMany(200, { rarity: "epic", templateId: "plate_chestplate", itemLevel: 80 })
		for (const item of items) {
			const defMod = item.explicits.find((m) => m.modifierId === "localDefenseFlat")
			if (defMod) {
				expect(defMod.description).toContain("Armor")
				expect(defMod.description).not.toContain("Defense")
			}
		}
	})

	it("plate armor localDefenseIncrease description says Armor", () => {
		const items = generateMany(200, { rarity: "epic", templateId: "plate_chestplate", itemLevel: 80 })
		for (const item of items) {
			const defMod = item.explicits.find((m) => m.modifierId === "localDefenseIncrease")
			if (defMod) {
				expect(defMod.description).toContain("Armor")
				expect(defMod.description).not.toContain("Defense")
			}
		}
	})

	it("computedDefenseStats reflects local defense mods", () => {
		const items = generateMany(300, { rarity: "epic", templateId: "plate_chestplate", itemLevel: 80 })
		const withDef = items.find((i) =>
			i.explicits.some((m) => m.modifierId === "localDefenseFlat") && i.computedDefenseStats,
		)
		if (withDef) {
			expect(withDef.computedDefenseStats!.armor).toBeGreaterThan(withDef.baseStats.armor ?? 0)
		}
	})
})

// ── Shield ──

describe("shield", () => {
	it("wooden shield has armorType plate", () => {
		const item = generateItem({ rarity: "normal", templateId: "wooden_shield" })
		expect(item.armorType).toBe("plate")
	})

	it("shield localDefenseFlat resolves to Armor", () => {
		const items = generateMany(200, { rarity: "epic", templateId: "wooden_shield", itemLevel: 80 })
		for (const item of items) {
			const defMod = item.explicits.find((m) => m.modifierId === "localDefenseFlat")
			if (defMod) {
				expect(defMod.description).toContain("Armor")
				expect(defMod.description).not.toContain("Defense")
			}
		}
	})

	it("shield can roll blockChanceIncrease", () => {
		const items = generateMany(200, { rarity: "epic", templateId: "wooden_shield", itemLevel: 80 })
		const rolledIds = allExplicitModIds(items)
		expect(rolledIds.has("blockChanceIncrease")).toBe(true)
	})

	it("blockChanceIncrease applies to shield base block chance", () => {
		let found = false
		for (let i = 0; i < 500 && !found; i++) {
			const item = generateItem({ rarity: "epic", templateId: "wooden_shield", itemLevel: 80 })
			const hasBlockMod = item.explicits.some((m) => m.modifierId === "blockChanceIncrease")
			if (hasBlockMod) {
				expect(item.computedDefenseStats?.blockChance).toBeDefined()
				expect(item.computedDefenseStats!.blockChance).toBeGreaterThan(22)
				found = true
			}
		}
		expect(found).toBe(true)
	})
})

// ── Jewelry: only global offensive mods ──

describe("jewelry mod eligibility", () => {
	const LOCAL_OFFENSIVE_MODS = [
		"physicalDamageIncrease", "attackSpeedIncrease", "criticalChanceIncrease",
		"coldDamageToAttacksFlat", "fireDamageToAttacksFlat",
		"lightningDamageToAttacksFlat", "voidDamageToAttacksFlat",
	]

	for (const templateId of JEWELRY_IDS) {
		it(`${templateId}: never rolls local offensive mods`, () => {
			const items = generateMany(100, { rarity: "epic", templateId, itemLevel: 80 })
			const rolledIds = allExplicitModIds(items)
			for (const localMod of LOCAL_OFFENSIVE_MODS) {
				expect(rolledIds.has(localMod)).toBe(false)
			}
		})
	}

	it("rings can roll physicalDamageFlatGlobal (global on jewelry)", () => {
		const items = generateMany(300, { rarity: "epic", templateId: "cobalt_ring", itemLevel: 80 })
		const rolledIds = allExplicitModIds(items)
		expect(rolledIds.has("physicalDamageFlatGlobal")).toBe(true)
	})

	it("rings do not get localDefenseFlat or localDefenseIncrease", () => {
		const items = generateMany(100, { rarity: "epic", templateId: "cobalt_ring", itemLevel: 80 })
		const rolledIds = allExplicitModIds(items)
		expect(rolledIds.has("localDefenseFlat")).toBe(false)
		expect(rolledIds.has("localDefenseIncrease")).toBe(false)
	})
})

// ── Implicits ──

describe("implicits", () => {
	it("cobalt ring has cold resistance implicit", () => {
		const item = generateItem({ rarity: "normal", templateId: "cobalt_ring" })
		expect(item.implicits).toHaveLength(1)
		expect(item.implicits[0].description).toContain("Cold Resistance")
	})

	it("gold amulet has all attributes implicit", () => {
		const item = generateItem({ rarity: "normal", templateId: "gold_amulet" })
		expect(item.implicits).toHaveLength(1)
		expect(item.implicits[0].description).toContain("all Attributes")
	})

	it("leather belt has max life implicit", () => {
		const item = generateItem({ rarity: "normal", templateId: "leather_belt" })
		expect(item.implicits).toHaveLength(1)
		expect(item.implicits[0].description).toContain("Maximum Life")
	})

	it("iron dagger has crit multiplier implicit", () => {
		const item = generateItem({ rarity: "normal", templateId: "iron_dagger" })
		expect(item.implicits).toHaveLength(1)
		expect(item.implicits[0].description).toContain("Critical Strike Multiplier")
	})

	it("templates with no implicits return empty array", () => {
		const item = generateItem({ rarity: "normal", templateId: "iron_greatsword" })
		expect(item.implicits).toHaveLength(0)
	})
})

// ── Global attack speed not on weapons ──

describe("globalAttackSpeedIncrease not on weapons", () => {
	for (const templateId of [...ATTACK_WEAPON_IDS, ...SPELL_WEAPON_IDS]) {
		it(`${templateId}: never rolls globalAttackSpeedIncrease`, () => {
			const items = generateMany(100, { rarity: "epic", templateId, itemLevel: 80 })
			const rolledIds = allExplicitModIds(items)
			expect(rolledIds.has("globalAttackSpeedIncrease")).toBe(false)
		})
	}

	it("rings can roll globalAttackSpeedIncrease", () => {
		const items = generateMany(300, { rarity: "epic", templateId: "cobalt_ring", itemLevel: 80 })
		const rolledIds = allExplicitModIds(items)
		expect(rolledIds.has("globalAttackSpeedIncrease")).toBe(true)
	})
})

// ── Bad/filler mods can actually roll ──

describe("filler mods exist in the pool", () => {
	it("lightRadius can roll on helmets", () => {
		const items = generateMany(300, { rarity: "epic", templateId: "plate_helmet", itemLevel: 80 })
		const rolledIds = allExplicitModIds(items)
		expect(rolledIds.has("lightRadius")).toBe(true)
	})

	it("thornsDamageFlat can roll on armor", () => {
		const items = generateMany(300, { rarity: "epic", templateId: "plate_chestplate", itemLevel: 80 })
		const rolledIds = allExplicitModIds(items)
		expect(rolledIds.has("thornsDamageFlat")).toBe(true)
	})

	it("lifeOnKillFlat can roll on weapons", () => {
		const items = generateMany(300, { rarity: "epic", templateId: "iron_sword", itemLevel: 80 })
		const rolledIds = allExplicitModIds(items)
		expect(rolledIds.has("lifeOnKillFlat")).toBe(true)
	})
})

// ── Flat damage min/max ranges ──

describe("flat damage mods roll as min-max range", () => {
	const FLAT_DAMAGE_MODS = [
		"physicalDamageFlat", "physicalDamageFlatGlobal",
		"coldDamageToAttacksFlat", "fireDamageToAttacksFlat",
		"lightningDamageToAttacksFlat", "voidDamageToAttacksFlat",
		"coldDamageFlat", "fireDamageFlat", "lightningDamageFlat", "voidDamageFlat",
	]

	it("all flat damage mods have minValue and maxValue", () => {
		const items = [
			...generateMany(200, { rarity: "epic", templateId: "iron_sword", itemLevel: 80 }),
			...generateMany(200, { rarity: "epic", templateId: "apprentice_staff", itemLevel: 80 }),
			...generateMany(200, { rarity: "epic", templateId: "cobalt_ring", itemLevel: 80 }),
		]
		for (const item of items) {
			for (const mod of item.explicits) {
				if (FLAT_DAMAGE_MODS.includes(mod.modifierId)) {
					expect(mod.minValue).toBeDefined()
					expect(mod.maxValue).toBeDefined()
				}
			}
		}
	})

	it("minValue is half of maxValue (rounded)", () => {
		const items = [
			...generateMany(200, { rarity: "epic", templateId: "iron_sword", itemLevel: 80 }),
			...generateMany(200, { rarity: "epic", templateId: "apprentice_staff", itemLevel: 80 }),
		]
		for (const item of items) {
			for (const mod of item.explicits) {
				if (mod.minValue != null && mod.maxValue != null && FLAT_DAMAGE_MODS.includes(mod.modifierId)) {
					expect(mod.minValue).toBe(Math.round(mod.maxValue / 2))
				}
			}
		}
	})

	it("minValue and maxValue are integers", () => {
		const items = [
			...generateMany(200, { rarity: "epic", templateId: "iron_sword", itemLevel: 80 }),
			...generateMany(200, { rarity: "epic", templateId: "apprentice_staff", itemLevel: 80 }),
		]
		for (const item of items) {
			for (const mod of item.explicits) {
				if (mod.minValue != null) expect(Number.isInteger(mod.minValue)).toBe(true)
				if (mod.maxValue != null) expect(Number.isInteger(mod.maxValue)).toBe(true)
			}
		}
	})

	it("flat damage descriptions show min-max range", () => {
		const items = [
			...generateMany(200, { rarity: "epic", templateId: "iron_sword", itemLevel: 80 }),
			...generateMany(200, { rarity: "epic", templateId: "apprentice_staff", itemLevel: 80 }),
		]
		for (const item of items) {
			for (const mod of item.explicits) {
				if (FLAT_DAMAGE_MODS.includes(mod.modifierId)) {
					expect(mod.description).toMatch(/\d+-\d+/)
				}
			}
		}
	})
})

// ── Synergy tag system (epic/legendary intelligent generation) ──

describe("synergy tags", () => {
	it("epic swords: majority of mods have attack or physical tags", () => {
		const items = generateMany(200, { rarity: "epic", templateId: "iron_sword", itemLevel: 80 })
		let tagged = 0
		let total = 0
		for (const item of items) {
			for (const mod of item.explicits) {
				total++
				const def = MODIFIERS[mod.modifierId as ModifierId]
				if (def.tags?.some((t) => t === "attack" || t === "physical")) tagged++
			}
		}
		// With seed tags ["attack", "physical", "critical"] and multiplier 3, expect strong bias
		expect(tagged / total).toBeGreaterThan(0.4)
	})

	it("epic staffs: majority of offensive mods have spell or elemental tags", () => {
		const items = generateMany(200, { rarity: "epic", templateId: "apprentice_staff", itemLevel: 80 })
		let tagged = 0
		let total = 0
		for (const item of items) {
			for (const mod of item.explicits) {
				total++
				const def = MODIFIERS[mod.modifierId as ModifierId]
				if (def.tags?.some((t) => t === "spell" || t === "elemental")) tagged++
			}
		}
		expect(tagged / total).toBeGreaterThan(0.4)
	})

	it("epic armor: majority of mods have defense or life tags", () => {
		const items = generateMany(200, { rarity: "epic", templateId: "plate_chestplate", itemLevel: 80 })
		let tagged = 0
		let total = 0
		for (const item of items) {
			for (const mod of item.explicits) {
				total++
				const def = MODIFIERS[mod.modifierId as ModifierId]
				if (def.tags?.some((t) => t === "defense" || t === "life")) tagged++
			}
		}
		expect(tagged / total).toBeGreaterThan(0.4)
	})

	it("epic items have higher tag overlap than rare items", () => {
		const measureOverlap = (items: GeneratedItem[]) => {
			let totalOverlap = 0
			for (const item of items) {
				const allTags = item.explicits.flatMap((m) => MODIFIERS[m.modifierId as ModifierId]?.tags ?? [])
				const unique = new Set(allTags)
				// overlap = how many duplicate tag appearances vs total
				totalOverlap += unique.size > 0 ? (allTags.length - unique.size) / allTags.length : 0
			}
			return totalOverlap / items.length
		}

		const epicItems = generateMany(300, { rarity: "epic", templateId: "iron_sword", itemLevel: 80 })
		const rareItems = generateMany(300, { rarity: "rare", templateId: "iron_sword", itemLevel: 80 })

		expect(measureOverlap(epicItems)).toBeGreaterThan(measureOverlap(rareItems))
	})

	it("legendary items show some synergy (more overlap than rare)", () => {
		const measureOverlap = (items: GeneratedItem[]) => {
			let totalOverlap = 0
			for (const item of items) {
				const allTags = item.explicits.flatMap((m) => MODIFIERS[m.modifierId as ModifierId]?.tags ?? [])
				const unique = new Set(allTags)
				totalOverlap += unique.size > 0 ? (allTags.length - unique.size) / allTags.length : 0
			}
			return totalOverlap / items.length
		}

		const legendaryItems = generateMany(300, { rarity: "legendary", templateId: "iron_sword", itemLevel: 80 })
		const rareItems = generateMany(300, { rarity: "rare", templateId: "iron_sword", itemLevel: 80 })

		expect(measureOverlap(legendaryItems)).toBeGreaterThan(measureOverlap(rareItems))
	})

	it("rare items have no synergy bias (same as before)", () => {
		// Rare items should not use synergy — verify by checking that filler mods still appear frequently
		const items = generateMany(300, { rarity: "rare", templateId: "plate_helmet", itemLevel: 80 })
		const rolledIds = allExplicitModIds(items)
		// lightRadius (weight 2000, no tags) should still appear often on rare
		expect(rolledIds.has("lightRadius")).toBe(true)
	})
})

// ── getSynergyWeight unit tests ──

describe("getSynergyWeight", () => {
	// Import the exported function
	it("returns baseWeight when no rolled tags", () => {
		expect(getSynergyWeight(1000, ["attack", "physical"], new Set(), 3)).toBe(1000)
	})

	it("returns baseWeight when multiplier is 0", () => {
		expect(getSynergyWeight(1000, ["attack"], new Set(["attack"]), 0)).toBe(1000)
	})

	it("returns baseWeight when candidate has no tags", () => {
		expect(getSynergyWeight(1000, [], new Set(["attack"]), 3)).toBe(1000)
	})

	it("boosts weight by multiplier per matching tag", () => {
		// 1 match: 1000 * (1 + 3*1) = 4000
		expect(getSynergyWeight(1000, ["attack", "cold"], new Set(["attack"]), 3)).toBe(4000)
		// 2 matches: 1000 * (1 + 3*2) = 7000
		expect(getSynergyWeight(1000, ["attack", "cold"], new Set(["attack", "cold"]), 3)).toBe(7000)
	})

	it("legendary multiplier is weaker", () => {
		// 2 matches: 1000 * (1 + 1.5*2) = 4000
		expect(getSynergyWeight(1000, ["attack", "cold"], new Set(["attack", "cold"]), 1.5)).toBe(4000)
	})
})

// ── Tier system ──

describe("tier system", () => {
	it("low level items get lower tier values", () => {
		const lowItems = generateMany(100, { rarity: "rare", templateId: "iron_sword", itemLevel: 5 })
		const highItems = generateMany(100, { rarity: "rare", templateId: "iron_sword", itemLevel: 95 })

		const avgValue = (items: GeneratedItem[]) => {
			const values = items.flatMap((i) => i.explicits.map((m) => m.value))
			return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
		}

		expect(avgValue(highItems)).toBeGreaterThan(avgValue(lowItems))
	})
})
