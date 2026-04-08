import { describe, expect, it } from "vitest";
import { MODIFIERS, type ModifierId } from "./data/modifiers";
import { EQUIPMENT_TEMPLATES } from "./data/templates";
import { generateItem, getSynergyWeight } from "./generator";
import type { GeneratedItem, ItemRarity } from "./types";

// ── Helpers ──

function generateMany(
	count: number,
	opts: { rarity: ItemRarity; templateId?: string; itemLevel?: number },
): GeneratedItem[] {
	return Array.from({ length: count }, () => generateItem(opts));
}

function allExplicitModIds(items: GeneratedItem[]): Set<string> {
	const ids = new Set<string>();
	for (const item of items) {
		for (const mod of item.explicits) ids.add(mod.modifierId);
	}
	return ids;
}

const ATTACK_WEAPON_IDS = [
	"sword_t1",
	"greatsword_t1",
	"dagger_t1",
	"bow_t1",
	"axe_t1",
	"mace_t1",
	"twoHandedAxe_t1",
];
const SPELL_WEAPON_IDS = ["staff_t1", "wand_t1"];
const JEWELRY_IDS = [
	"cobalt_ring",
	"garnet_ring",
	"topaz_ring",
	"obsidian_ring",
	"coral_ring",
	"lapis_ring",
	"gold_amulet",
	"jade_amulet",
	"amber_amulet",
	"lapis_amulet",
	"leather_belt",
	"chain_belt",
	"studded_belt",
	"cloth_belt",
	"prismatic_belt",
	"silk_belt",
];

// ── Basic generation ──

describe("generateItem basics", () => {
	it("returns a valid item with all required fields", () => {
		const item = generateItem({ rarity: "rare", itemLevel: 50 });
		expect(item.id).toBeTruthy();
		expect(item.templateId).toBeTruthy();
		expect(item.templateName).toBeTruthy();
		expect(item.equipmentType).toBeTruthy();
		expect(item.rarity).toBe("rare");
		expect(item.itemLevel).toBe(50);
		expect(item.baseStats).toBeDefined();
		expect(item.implicits).toBeDefined();
		expect(item.explicits).toBeDefined();
	});

	it("generates a normal item with 0 explicits", () => {
		const item = generateItem({ rarity: "normal", itemLevel: 50 });
		expect(item.explicits).toHaveLength(0);
	});

	it("uses specified templateId", () => {
		const item = generateItem({ rarity: "normal", templateId: "sword_t1" });
		expect(item.templateId).toBe("sword_t1");
		expect(item.templateName).toBe("Iron Sword");
	});

	it("falls back to random template when templateId is invalid", () => {
		const item = generateItem({ rarity: "normal", templateId: "nonexistent" });
		expect(item.templateId).toBeTruthy();
	});
});

// ── Mod counts per rarity ──

describe("mod counts per rarity", () => {
	it("magic items have 1-2 explicits", () => {
		const items = generateMany(100, { rarity: "magic", itemLevel: 80 });
		for (const item of items) {
			expect(item.explicits.length).toBeGreaterThanOrEqual(1);
			expect(item.explicits.length).toBeLessThanOrEqual(2);
		}
	});

	it("rare items have 3-4 explicits", () => {
		const items = generateMany(100, { rarity: "rare", itemLevel: 80 });
		for (const item of items) {
			expect(item.explicits.length).toBeGreaterThanOrEqual(3);
			expect(item.explicits.length).toBeLessThanOrEqual(4);
		}
	});

	it("legendary items have 5 explicits", () => {
		const items = generateMany(100, {
			rarity: "legendary",
			itemLevel: 80,
			templateId: "sword_t1",
		});
		for (const item of items) {
			expect(item.explicits.length).toBe(5);
		}
	});

	it("epic items have 6 explicits", () => {
		const items = generateMany(100, {
			rarity: "epic",
			itemLevel: 80,
			templateId: "sword_t1",
		});
		for (const item of items) {
			expect(item.explicits.length).toBe(6);
		}
	});
});

// ── Prefix / suffix limits ──

describe("prefix and suffix limits", () => {
	it("never exceeds 3 prefixes or 3 suffixes", () => {
		const items = generateMany(200, { rarity: "epic", itemLevel: 80 });
		for (const item of items) {
			const prefixes = item.explicits.filter(
				(m) => m.affixType === "prefix",
			).length;
			const suffixes = item.explicits.filter(
				(m) => m.affixType === "suffix",
			).length;
			expect(prefixes).toBeLessThanOrEqual(3);
			expect(suffixes).toBeLessThanOrEqual(3);
		}
	});

	it("magic items never exceed 2 prefixes or 2 suffixes", () => {
		const items = generateMany(200, { rarity: "magic", itemLevel: 80 });
		for (const item of items) {
			const prefixes = item.explicits.filter(
				(m) => m.affixType === "prefix",
			).length;
			const suffixes = item.explicits.filter(
				(m) => m.affixType === "suffix",
			).length;
			expect(prefixes).toBeLessThanOrEqual(2);
			expect(suffixes).toBeLessThanOrEqual(2);
		}
	});
});

// ── No duplicate mods ──

describe("no duplicate modifiers", () => {
	it("never rolls the same modifier twice on one item", () => {
		const items = generateMany(200, { rarity: "epic", itemLevel: 80 });
		for (const item of items) {
			const ids = item.explicits.map((m) => m.modifierId);
			expect(new Set(ids).size).toBe(ids.length);
		}
	});
});

// ── No decimals ──

describe("no decimal values", () => {
	it("all explicit mod values are integers", () => {
		const items = generateMany(200, { rarity: "epic", itemLevel: 80 });
		for (const item of items) {
			for (const mod of item.explicits) {
				expect(Number.isInteger(mod.value)).toBe(true);
			}
		}
	});

	it("all implicit values are integers", () => {
		const items = generateMany(200, { rarity: "rare", itemLevel: 80 });
		for (const item of items) {
			for (const mod of item.implicits) {
				expect(Number.isInteger(mod.value)).toBe(true);
			}
		}
	});

	it("descriptions contain no decimal points", () => {
		const items = generateMany(200, { rarity: "epic", itemLevel: 80 });
		for (const item of items) {
			for (const mod of item.explicits) {
				expect(mod.description).not.toMatch(/\d+\.\d+/);
			}
		}
	});
});

// ── RolledMod fields ──

describe("RolledMod carries modifierType and isGlobalStat", () => {
	it("every explicit has modifierType and isGlobalStat", () => {
		const items = generateMany(50, { rarity: "epic", itemLevel: 80 });
		for (const item of items) {
			for (const mod of item.explicits) {
				expect(["flat", "increased", "more"]).toContain(mod.modifierType);
				expect(typeof mod.isGlobalStat).toBe("boolean");
			}
		}
	});

	it("isGlobalStat matches the modifier definition", () => {
		const items = generateMany(50, { rarity: "epic", itemLevel: 80 });
		for (const item of items) {
			for (const mod of item.explicits) {
				const def = MODIFIERS[mod.modifierId as ModifierId];
				expect(mod.isGlobalStat).toBe(def.isGlobalStat ?? false);
			}
		}
	});
});

// ── Explicit ordering ──

describe("explicit ordering", () => {
	it("prefixes come before suffixes", () => {
		const items = generateMany(200, { rarity: "epic", itemLevel: 80 });
		for (const item of items) {
			let seenSuffix = false;
			for (const mod of item.explicits) {
				if (mod.affixType === "suffix") seenSuffix = true;
				if (mod.affixType === "prefix") expect(seenSuffix).toBe(false);
			}
		}
	});

	it("within same affix type, increased comes before flat", () => {
		const items = generateMany(200, { rarity: "epic", itemLevel: 80 });
		for (const item of items) {
			const prefixes = item.explicits.filter((m) => m.affixType === "prefix");
			const suffixes = item.explicits.filter((m) => m.affixType === "suffix");

			for (const group of [prefixes, suffixes]) {
				let seenFlat = false;
				for (const mod of group) {
					if (mod.modifierType === "flat") seenFlat = true;
					if (mod.modifierType === "increased") expect(seenFlat).toBe(false);
				}
			}
		}
	});
});

// ── Naming ──

describe("item naming", () => {
	it("normal items use template name", () => {
		const item = generateItem({ rarity: "normal", templateId: "sword_t1" });
		expect(item.name).toBe("Iron Sword");
	});

	it("magic items include affix names", () => {
		const items = generateMany(50, {
			rarity: "magic",
			templateId: "sword_t1",
			itemLevel: 80,
		});
		for (const item of items) {
			expect(item.name).toContain("Iron Sword");
		}
	});

	it("rare/legendary/epic items have generated names", () => {
		for (const rarity of ["rare", "legendary", "epic"] as ItemRarity[]) {
			const items = generateMany(20, { rarity, itemLevel: 80 });
			for (const item of items) {
				expect(item.name).not.toBe(item.templateName);
				expect(item.name.split(" ")).toHaveLength(2);
			}
		}
	});
});

// ── Spell weapons: no attack mods ──

describe("spell weapons (staff/wand)", () => {
	const LOCAL_ATTACK_MODS = [
		"physicalDamageFlat",
		"physicalDamageIncrease",
		"attackSpeedIncrease",
		"criticalChanceIncrease",
		"coldDamageToAttacksFlat",
		"fireDamageToAttacksFlat",
		"lightningDamageToAttacksFlat",
		"voidDamageToAttacksFlat",
		"accuracyFlat",
	];

	for (const templateId of SPELL_WEAPON_IDS) {
		it(`${templateId}: never rolls local attack mods`, () => {
			const items = generateMany(100, {
				rarity: "epic",
				templateId,
				itemLevel: 80,
			});
			const rolledIds = allExplicitModIds(items);
			for (const attackMod of LOCAL_ATTACK_MODS) {
				expect(rolledIds.has(attackMod)).toBe(false);
			}
		});

		it(`${templateId}: does not compute weapon stats`, () => {
			const items = generateMany(50, {
				rarity: "epic",
				templateId,
				itemLevel: 80,
			});
			for (const item of items) {
				expect(item.computedStats).toBeUndefined();
			}
		});

		it(`${templateId}: can roll spell damage flat mods`, () => {
			const items = generateMany(200, {
				rarity: "epic",
				templateId,
				itemLevel: 80,
			});
			const rolledIds = allExplicitModIds(items);
			const spellMods = [
				"coldDamageFlat",
				"fireDamageFlat",
				"lightningDamageFlat",
				"voidDamageFlat",
			];
			const hasAny = spellMods.some((id) => rolledIds.has(id));
			expect(hasAny).toBe(true);
		});
	}
});

// ── Attack weapons: compute weapon stats ──

describe("attack weapon computed stats", () => {
	it("computes physicalDamage with flat min/max added", () => {
		const items = generateMany(300, {
			rarity: "epic",
			templateId: "sword_t1",
			itemLevel: 80,
		});
		const withFlat = items.find(
			(i) =>
				i.explicits.some((m) => m.modifierId === "physicalDamageFlat") &&
				i.computedStats,
		);
		if (withFlat) {
			const flatMod = withFlat.explicits.find(
				(m) => m.modifierId === "physicalDamageFlat",
			)!;
			expect(flatMod.minValue).toBeDefined();
			expect(flatMod.maxValue).toBeDefined();
			expect(withFlat.computedStats!.physicalDamage.min).toBeGreaterThanOrEqual(
				(withFlat.baseStats.minDamage ?? 0) + flatMod.minValue!,
			);
			expect(withFlat.computedStats!.physicalDamage.max).toBeGreaterThanOrEqual(
				(withFlat.baseStats.maxDamage ?? 0) + flatMod.maxValue!,
			);
		}
	});

	it("crit chance is increased (multiplicative), not flat additive", () => {
		const items = generateMany(300, {
			rarity: "epic",
			templateId: "sword_t1",
			itemLevel: 80,
		});
		const withCrit = items.find(
			(i) =>
				i.explicits.some((m) => m.modifierId === "criticalChanceIncrease") &&
				!i.explicits.some((m) => m.modifierId === "physicalDamageFlat") &&
				i.computedStats,
		);
		if (withCrit) {
			const critMod = withCrit.explicits.find(
				(m) => m.modifierId === "criticalChanceIncrease",
			)!;
			const base = withCrit.baseStats.criticalChance ?? 5;
			const expected = Math.round(base * (1 + critMod.value / 100) * 10) / 10;
			expect(withCrit.computedStats!.criticalChance).toBe(expected);
		}
	});

	it("attack weapons always have computedStats", () => {
		for (const templateId of ATTACK_WEAPON_IDS) {
			const item = generateItem({
				rarity: "normal",
				templateId,
				itemLevel: 50,
			});
			expect(item.computedStats).toBeDefined();
		}
	});
});

// ── Armor: local defense mods ──

describe("armor local defense", () => {
	it("plate armor localDefenseFlat description says Armor, not Defense", () => {
		const items = generateMany(200, {
			rarity: "epic",
			templateId: "plate_chestplate_t1",
			itemLevel: 80,
		});
		for (const item of items) {
			const defMod = item.explicits.find(
				(m) => m.modifierId === "localDefenseFlat",
			);
			if (defMod) {
				expect(defMod.description).toContain("Armor");
				expect(defMod.description).not.toContain("Defense");
			}
		}
	});

	it("plate armor localDefenseIncrease description says Armor", () => {
		const items = generateMany(200, {
			rarity: "epic",
			templateId: "plate_chestplate_t1",
			itemLevel: 80,
		});
		for (const item of items) {
			const defMod = item.explicits.find(
				(m) => m.modifierId === "localDefenseIncrease",
			);
			if (defMod) {
				expect(defMod.description).toContain("Armor");
				expect(defMod.description).not.toContain("Defense");
			}
		}
	});

	it("computedDefenseStats reflects local defense mods", () => {
		const items = generateMany(300, {
			rarity: "epic",
			templateId: "plate_chestplate_t1",
			itemLevel: 80,
		});
		const withDef = items.find(
			(i) =>
				i.explicits.some((m) => m.modifierId === "localDefenseFlat") &&
				i.computedDefenseStats,
		);
		if (withDef) {
			expect(withDef.computedDefenseStats!.armor).toBeGreaterThan(
				withDef.baseStats.armor ?? 0,
			);
		}
	});
});

// ── Global defense % armorType filtering ──

describe("global defense % mods respect armorType", () => {
	it("plate armor never rolls globalEvasionIncrease or globalBarrierIncrease", () => {
		const items = generateMany(300, {
			rarity: "epic",
			templateId: "plate_boots_t1",
			itemLevel: 80,
		});
		const rolledIds = allExplicitModIds(items);
		expect(rolledIds.has("globalEvasionIncrease")).toBe(false);
		expect(rolledIds.has("globalBarrierIncrease")).toBe(false);
	});

	it("plate armor can still roll globalArmorIncrease", () => {
		const items = generateMany(300, {
			rarity: "legendary",
			templateId: "plate_boots_t1",
			itemLevel: 80,
		});
		const rolledIds = allExplicitModIds(items);
		expect(rolledIds.has("globalArmorIncrease")).toBe(true);
	});

	it("jewelry can roll all three global defense % mods", () => {
		const items = generateMany(500, {
			rarity: "legendary",
			templateId: "cobalt_ring",
			itemLevel: 80,
		});
		const rolledIds = allExplicitModIds(items);
		expect(rolledIds.has("globalArmorIncrease")).toBe(true);
		expect(rolledIds.has("globalEvasionIncrease")).toBe(true);
		expect(rolledIds.has("globalBarrierIncrease")).toBe(true);
	});

	it("plate shield never rolls mismatched global defense % mods", () => {
		const items = generateMany(300, {
			rarity: "epic",
			templateId: "plate_shield_t1",
			itemLevel: 80,
		});
		const rolledIds = allExplicitModIds(items);
		expect(rolledIds.has("globalEvasionIncrease")).toBe(false);
		expect(rolledIds.has("globalBarrierIncrease")).toBe(false);
	});

	it("leather shield never rolls mismatched global defense % mods", () => {
		const items = generateMany(300, {
			rarity: "epic",
			templateId: "leather_shield_t1",
			itemLevel: 80,
		});
		const rolledIds = allExplicitModIds(items);
		expect(rolledIds.has("globalArmorIncrease")).toBe(false);
		expect(rolledIds.has("globalBarrierIncrease")).toBe(false);
	});

	it("silk shield never rolls mismatched global defense % mods", () => {
		const items = generateMany(300, {
			rarity: "epic",
			templateId: "silk_shield_t1",
			itemLevel: 80,
		});
		const rolledIds = allExplicitModIds(items);
		expect(rolledIds.has("globalArmorIncrease")).toBe(false);
		expect(rolledIds.has("globalEvasionIncrease")).toBe(false);
	});
});

// ── Shield ──

describe("shield", () => {
	it("plate shield has armorType plate", () => {
		const item = generateItem({
			rarity: "normal",
			templateId: "plate_shield_t1",
		});
		expect(item.armorType).toBe("plate");
	});

	it("leather shield has armorType leather", () => {
		const item = generateItem({
			rarity: "normal",
			templateId: "leather_shield_t1",
		});
		expect(item.armorType).toBe("leather");
	});

	it("silk shield has armorType silk", () => {
		const item = generateItem({
			rarity: "normal",
			templateId: "silk_shield_t1",
		});
		expect(item.armorType).toBe("silk");
	});

	it("plate shield localDefenseFlat resolves to Armor", () => {
		const items = generateMany(200, {
			rarity: "epic",
			templateId: "plate_shield_t1",
			itemLevel: 80,
		});
		for (const item of items) {
			const defMod = item.explicits.find(
				(m) => m.modifierId === "localDefenseFlat",
			);
			if (defMod) {
				expect(defMod.description).toContain("Armor");
				expect(defMod.description).not.toContain("Defense");
			}
		}
	});

	it("leather shield localDefenseFlat resolves to Evasion Rating", () => {
		const items = generateMany(200, {
			rarity: "epic",
			templateId: "leather_shield_t1",
			itemLevel: 80,
		});
		for (const item of items) {
			const defMod = item.explicits.find(
				(m) => m.modifierId === "localDefenseFlat",
			);
			if (defMod) {
				expect(defMod.description).toContain("Evasion Rating");
				expect(defMod.description).not.toContain("Defense");
			}
		}
	});

	it("silk shield localDefenseFlat resolves to Barrier", () => {
		const items = generateMany(200, {
			rarity: "epic",
			templateId: "silk_shield_t1",
			itemLevel: 80,
		});
		for (const item of items) {
			const defMod = item.explicits.find(
				(m) => m.modifierId === "localDefenseFlat",
			);
			if (defMod) {
				expect(defMod.description).toContain("Barrier");
				expect(defMod.description).not.toContain("Defense");
			}
		}
	});

	it("plate shield has only armor defense stat (no evasion/barrier)", () => {
		const item = generateItem({
			rarity: "normal",
			templateId: "plate_shield_t1",
		});
		expect(item.baseStats.armor).toBeDefined();
		expect(item.baseStats.evasion).toBeUndefined();
		expect(item.baseStats.barrier).toBeUndefined();
	});

	it("leather shield has only evasion defense stat (no armor/barrier)", () => {
		const item = generateItem({
			rarity: "normal",
			templateId: "leather_shield_t1",
		});
		expect(item.baseStats.evasion).toBeDefined();
		expect(item.baseStats.armor).toBeUndefined();
		expect(item.baseStats.barrier).toBeUndefined();
	});

	it("silk shield has only barrier defense stat (no armor/evasion)", () => {
		const item = generateItem({
			rarity: "normal",
			templateId: "silk_shield_t1",
		});
		expect(item.baseStats.barrier).toBeDefined();
		expect(item.baseStats.armor).toBeUndefined();
		expect(item.baseStats.evasion).toBeUndefined();
	});

	it("all shield variants have blockChance base stat", () => {
		for (const templateId of [
			"plate_shield_t1",
			"leather_shield_t1",
			"silk_shield_t1",
		]) {
			const item = generateItem({ rarity: "normal", templateId });
			expect(item.baseStats.blockChance).toBeDefined();
		}
	});

	it("shield can roll blockChanceIncrease", () => {
		const items = generateMany(200, {
			rarity: "epic",
			templateId: "plate_shield_t1",
			itemLevel: 80,
		});
		const rolledIds = allExplicitModIds(items);
		expect(rolledIds.has("blockChanceIncrease")).toBe(true);
	});

	it("blockChanceIncrease applies to shield base block chance", () => {
		let found = false;
		for (let i = 0; i < 500 && !found; i++) {
			const item = generateItem({
				rarity: "epic",
				templateId: "plate_shield_t1",
				itemLevel: 80,
			});
			const hasBlockMod = item.explicits.some(
				(m) => m.modifierId === "blockChanceIncrease",
			);
			if (hasBlockMod) {
				expect(item.computedDefenseStats?.blockChance).toBeDefined();
				expect(item.computedDefenseStats!.blockChance).toBeGreaterThan(22);
				found = true;
			}
		}
		expect(found).toBe(true);
	});
});

// ── Jewelry: only global offensive mods ──

describe("jewelry mod eligibility", () => {
	const LOCAL_OFFENSIVE_MODS = [
		"physicalDamageIncrease",
		"attackSpeedIncrease",
		"criticalChanceIncrease",
		"coldDamageToAttacksFlat",
		"fireDamageToAttacksFlat",
		"lightningDamageToAttacksFlat",
		"voidDamageToAttacksFlat",
	];

	for (const templateId of JEWELRY_IDS) {
		it(`${templateId}: never rolls local offensive mods`, () => {
			const items = generateMany(100, {
				rarity: "epic",
				templateId,
				itemLevel: 80,
			});
			const rolledIds = allExplicitModIds(items);
			for (const localMod of LOCAL_OFFENSIVE_MODS) {
				expect(rolledIds.has(localMod)).toBe(false);
			}
		});
	}

	it("rings can roll physicalDamageFlatGlobal (global on jewelry)", () => {
		const items = generateMany(300, {
			rarity: "epic",
			templateId: "cobalt_ring",
			itemLevel: 80,
		});
		const rolledIds = allExplicitModIds(items);
		expect(rolledIds.has("physicalDamageFlatGlobal")).toBe(true);
	});

	it("rings do not get localDefenseFlat or localDefenseIncrease", () => {
		const items = generateMany(100, {
			rarity: "epic",
			templateId: "cobalt_ring",
			itemLevel: 80,
		});
		const rolledIds = allExplicitModIds(items);
		expect(rolledIds.has("localDefenseFlat")).toBe(false);
		expect(rolledIds.has("localDefenseIncrease")).toBe(false);
	});
});

// ── Implicits ──

describe("implicits", () => {
	it("cobalt ring has cold resistance implicit", () => {
		const item = generateItem({ rarity: "normal", templateId: "cobalt_ring" });
		expect(item.implicits).toHaveLength(1);
		expect(item.implicits[0].description).toContain("Cold Resistance");
	});

	it("gold amulet has all attributes implicit", () => {
		const item = generateItem({ rarity: "normal", templateId: "gold_amulet" });
		expect(item.implicits).toHaveLength(1);
		expect(item.implicits[0].description).toContain("all Attributes");
	});

	it("leather belt has max life implicit", () => {
		const item = generateItem({ rarity: "normal", templateId: "leather_belt" });
		expect(item.implicits).toHaveLength(1);
		expect(item.implicits[0].description).toContain("Maximum Life");
	});

	it("iron dagger has crit multiplier implicit", () => {
		const item = generateItem({ rarity: "normal", templateId: "dagger_t1" });
		expect(item.implicits).toHaveLength(1);
		expect(item.implicits[0].description).toContain(
			"Critical Strike Multiplier",
		);
	});

	it("templates with no implicits return empty array", () => {
		const item = generateItem({
			rarity: "normal",
			templateId: "greatsword_t1",
		});
		expect(item.implicits).toHaveLength(0);
	});
});

// ── Global attack speed not on weapons ──

describe("globalAttackSpeedIncrease not on weapons", () => {
	for (const templateId of [...ATTACK_WEAPON_IDS, ...SPELL_WEAPON_IDS]) {
		it(`${templateId}: never rolls globalAttackSpeedIncrease`, () => {
			const items = generateMany(100, {
				rarity: "epic",
				templateId,
				itemLevel: 80,
			});
			const rolledIds = allExplicitModIds(items);
			expect(rolledIds.has("globalAttackSpeedIncrease")).toBe(false);
		});
	}

	it("rings can roll globalAttackSpeedIncrease", () => {
		const items = generateMany(300, {
			rarity: "legendary",
			templateId: "cobalt_ring",
			itemLevel: 80,
		});
		const rolledIds = allExplicitModIds(items);
		expect(rolledIds.has("globalAttackSpeedIncrease")).toBe(true);
	});
});

// ── globalMeleeDamageIncrease not on weapons ──

describe("globalMeleeDamageIncrease not on weapons", () => {
	for (const templateId of ATTACK_WEAPON_IDS) {
		it(`${templateId}: never rolls globalMeleeDamageIncrease`, () => {
			const items = generateMany(100, {
				rarity: "legendary",
				templateId,
				itemLevel: 80,
			});
			const rolledIds = allExplicitModIds(items);
			expect(rolledIds.has("globalMeleeDamageIncrease")).toBe(false);
		});
	}
});

// ── item rarity mods not on chestplates or boots ──

describe("item rarity mods not on chestplates or boots", () => {
	for (const templateId of ["plate_chestplate_t1", "plate_boots_t1"]) {
		it(`${templateId}: never rolls item rarity mods`, () => {
			const items = generateMany(200, {
				rarity: "legendary",
				templateId,
				itemLevel: 80,
			});
			const rolledIds = allExplicitModIds(items);
			expect(rolledIds.has("itemRarityIncreasePrefix")).toBe(false);
			expect(rolledIds.has("itemRarityIncreaseSuffix")).toBe(false);
		});
	}
});

// ── Bad/filler mods can actually roll ──

describe("filler mods exist in the pool", () => {
	it("lightRadius can roll on helmets", () => {
		const items = generateMany(300, {
			rarity: "legendary",
			templateId: "plate_helmet_t1",
			itemLevel: 80,
		});
		const rolledIds = allExplicitModIds(items);
		expect(rolledIds.has("lightRadius")).toBe(true);
	});

	it("thornsDamageFlat can roll on armor", () => {
		const items = generateMany(300, {
			rarity: "legendary",
			templateId: "plate_chestplate_t1",
			itemLevel: 80,
		});
		const rolledIds = allExplicitModIds(items);
		expect(rolledIds.has("thornsDamageFlat")).toBe(true);
	});

	it("lifeOnKillFlat can roll on weapons", () => {
		const items = generateMany(300, {
			rarity: "legendary",
			templateId: "sword_t1",
			itemLevel: 80,
		});
		const rolledIds = allExplicitModIds(items);
		expect(rolledIds.has("lifeOnKillFlat")).toBe(true);
	});
});

// ── Flat damage min/max ranges ──

describe("flat damage mods roll as min-max range", () => {
	const FLAT_DAMAGE_MODS = [
		"physicalDamageFlat",
		"physicalDamageFlatGlobal",
		"coldDamageToAttacksFlat",
		"fireDamageToAttacksFlat",
		"lightningDamageToAttacksFlat",
		"voidDamageToAttacksFlat",
		"coldDamageFlat",
		"fireDamageFlat",
		"lightningDamageFlat",
		"voidDamageFlat",
	];

	it("all flat damage mods have minValue and maxValue", () => {
		const items = [
			...generateMany(200, {
				rarity: "epic",
				templateId: "sword_t1",
				itemLevel: 80,
			}),
			...generateMany(200, {
				rarity: "epic",
				templateId: "staff_t1",
				itemLevel: 80,
			}),
			...generateMany(200, {
				rarity: "epic",
				templateId: "cobalt_ring",
				itemLevel: 80,
			}),
		];
		for (const item of items) {
			for (const mod of item.explicits) {
				if (FLAT_DAMAGE_MODS.includes(mod.modifierId)) {
					expect(mod.minValue).toBeDefined();
					expect(mod.maxValue).toBeDefined();
				}
			}
		}
	});

	it("minValue is half of maxValue (rounded)", () => {
		const items = [
			...generateMany(200, {
				rarity: "epic",
				templateId: "sword_t1",
				itemLevel: 80,
			}),
			...generateMany(200, {
				rarity: "epic",
				templateId: "staff_t1",
				itemLevel: 80,
			}),
		];
		for (const item of items) {
			for (const mod of item.explicits) {
				if (
					mod.minValue != null &&
					mod.maxValue != null &&
					FLAT_DAMAGE_MODS.includes(mod.modifierId)
				) {
					expect(mod.minValue).toBe(Math.round(mod.maxValue / 2));
				}
			}
		}
	});

	it("minValue and maxValue are integers", () => {
		const items = [
			...generateMany(200, {
				rarity: "epic",
				templateId: "sword_t1",
				itemLevel: 80,
			}),
			...generateMany(200, {
				rarity: "epic",
				templateId: "staff_t1",
				itemLevel: 80,
			}),
		];
		for (const item of items) {
			for (const mod of item.explicits) {
				if (mod.minValue != null)
					expect(Number.isInteger(mod.minValue)).toBe(true);
				if (mod.maxValue != null)
					expect(Number.isInteger(mod.maxValue)).toBe(true);
			}
		}
	});

	it("flat damage descriptions show min-max range", () => {
		const items = [
			...generateMany(200, {
				rarity: "epic",
				templateId: "sword_t1",
				itemLevel: 80,
			}),
			...generateMany(200, {
				rarity: "epic",
				templateId: "staff_t1",
				itemLevel: 80,
			}),
		];
		for (const item of items) {
			for (const mod of item.explicits) {
				if (FLAT_DAMAGE_MODS.includes(mod.modifierId)) {
					expect(mod.description).toMatch(/\d+-\d+/);
				}
			}
		}
	});
});

// ── Synergy tag system (legendary intelligent generation) ──

describe("synergy tags", () => {
	it("legendary items show some synergy (more overlap than rare)", () => {
		const measureOverlap = (items: GeneratedItem[]) => {
			let totalOverlap = 0;
			for (const item of items) {
				const allTags = item.explicits.flatMap(
					(m) => MODIFIERS[m.modifierId as ModifierId]?.tags ?? [],
				);
				const unique = new Set(allTags);
				totalOverlap +=
					unique.size > 0 ? (allTags.length - unique.size) / allTags.length : 0;
			}
			return totalOverlap / items.length;
		};

		const legendaryItems = generateMany(300, {
			rarity: "legendary",
			templateId: "sword_t1",
			itemLevel: 80,
		});
		const rareItems = generateMany(300, {
			rarity: "rare",
			templateId: "sword_t1",
			itemLevel: 80,
		});

		expect(measureOverlap(legendaryItems)).toBeGreaterThan(
			measureOverlap(rareItems),
		);
	});

	it("rare items have no synergy bias (same as before)", () => {
		// Rare items should not use synergy — verify by checking that filler mods still appear frequently
		const items = generateMany(300, {
			rarity: "rare",
			templateId: "plate_helmet_t1",
			itemLevel: 80,
		});
		const rolledIds = allExplicitModIds(items);
		// lightRadius (weight 2000, no tags) should still appear often on rare
		expect(rolledIds.has("lightRadius")).toBe(true);
	});
});

// ── Deterministic epic mod patterns ──

describe("deterministic epic patterns", () => {
	const ATTACK_WEAPON_PATTERN_PREFIXES = new Set([
		"physicalDamageFlat",
		"physicalDamageIncrease",
		"coldDamageToAttacksFlat",
		"fireDamageToAttacksFlat",
		"lightningDamageToAttacksFlat",
		"voidDamageToAttacksFlat",
	]);
	const ATTACK_WEAPON_PATTERN_SUFFIXES = new Set([
		"attackSpeedIncrease",
		"criticalChanceIncrease",
		"criticalStrikeMultiplierFlat",
		"accuracyFlat",
	]);

	const SPELL_WEAPON_PATTERN_PREFIXES = new Set([
		"coldDamageFlat",
		"fireDamageFlat",
		"lightningDamageFlat",
		"voidDamageFlat",
		"globalSpellDamageIncrease",
		"globalColdDamageIncrease",
		"globalFireDamageIncrease",
		"globalLightningDamageIncrease",
		"globalVoidDamageIncrease",
		"globalElementalDamageIncrease",
	]);
	const SPELL_WEAPON_PATTERN_SUFFIXES = new Set([
		"globalCastSpeedIncrease",
		"globalCriticalChanceIncrease",
		"criticalStrikeMultiplierFlat",
		"manaRegenFlat",
	]);

	const ARMOR_PATTERN_PREFIXES = new Set([
		"localDefenseFlat",
		"healthFlat",
		"manaFlat",
	]);
	const ARMOR_PATTERN_SUFFIXES = new Set([
		"localDefenseIncrease",
		"coldResistance",
		"fireResistance",
		"lightningResistance",
		"voidResistance",
		"healthRegenFlat",
	]);

	const BELT_PATTERN_PREFIXES = new Set([
		"healthFlat",
		"armorFlat",
		"evasionFlat",
		"barrierFlat",
		"manaFlat",
	]);
	const BELT_PATTERN_SUFFIXES = new Set([
		"coldResistance",
		"fireResistance",
		"lightningResistance",
		"voidResistance",
		"strengthFlat",
		"dexterityFlat",
		"intelligenceFlat",
	]);

	it("epic attack weapon: all mods from attack pattern pool", () => {
		const items = generateMany(200, {
			rarity: "epic",
			templateId: "sword_t1",
			itemLevel: 80,
		});
		for (const item of items) {
			for (const mod of item.explicits) {
				if (mod.affixType === "prefix") {
					expect(ATTACK_WEAPON_PATTERN_PREFIXES.has(mod.modifierId)).toBe(true);
				} else {
					expect(ATTACK_WEAPON_PATTERN_SUFFIXES.has(mod.modifierId)).toBe(true);
				}
			}
		}
	});

	it("epic spell weapon: all mods from spell pattern pool", () => {
		const items = generateMany(200, {
			rarity: "epic",
			templateId: "staff_t1",
			itemLevel: 80,
		});
		for (const item of items) {
			for (const mod of item.explicits) {
				if (mod.affixType === "prefix") {
					expect(SPELL_WEAPON_PATTERN_PREFIXES.has(mod.modifierId)).toBe(true);
				} else {
					expect(SPELL_WEAPON_PATTERN_SUFFIXES.has(mod.modifierId)).toBe(true);
				}
			}
		}
	});

	it("epic armor: all mods from defense/life/resistance pool", () => {
		const items = generateMany(200, {
			rarity: "epic",
			templateId: "plate_chestplate_t1",
			itemLevel: 80,
		});
		for (const item of items) {
			for (const mod of item.explicits) {
				if (mod.affixType === "prefix") {
					expect(ARMOR_PATTERN_PREFIXES.has(mod.modifierId)).toBe(true);
				} else {
					expect(ARMOR_PATTERN_SUFFIXES.has(mod.modifierId)).toBe(true);
				}
			}
		}
	});

	it("epic boots: can roll movementSpeedIncrease (boots special)", () => {
		const items = generateMany(300, {
			rarity: "epic",
			templateId: "plate_boots_t1",
			itemLevel: 80,
		});
		const rolledIds = allExplicitModIds(items);
		expect(rolledIds.has("movementSpeedIncrease")).toBe(true);
	});

	it("epic belt: prefixes are life/defense, suffixes are resistances/attributes", () => {
		const items = generateMany(200, {
			rarity: "epic",
			templateId: "leather_belt",
			itemLevel: 80,
		});
		for (const item of items) {
			for (const mod of item.explicits) {
				if (mod.affixType === "prefix") {
					expect(BELT_PATTERN_PREFIXES.has(mod.modifierId)).toBe(true);
				} else {
					expect(BELT_PATTERN_SUFFIXES.has(mod.modifierId)).toBe(true);
				}
			}
		}
	});

	it("epic items always roll tier 4 or better", () => {
		// Even at low ilvl, epic should clamp to tier 4 minimum
		const items = generateMany(200, {
			rarity: "epic",
			templateId: "sword_t1",
			itemLevel: 10,
		});
		for (const item of items) {
			for (const mod of item.explicits) {
				expect(mod.tier).toBeLessThanOrEqual(4);
			}
		}
	});

	it("epic items at high ilvl can roll tier 1", () => {
		const items = generateMany(200, {
			rarity: "epic",
			templateId: "sword_t1",
			itemLevel: 95,
		});
		const tiers = items.flatMap((i) => i.explicits.map((m) => m.tier));
		expect(tiers.some((t) => t === 1)).toBe(true);
	});

	it("legendary items unchanged (still use synergy weight system, not patterns)", () => {
		// Legendary can still roll mods outside any pattern pool (e.g., lifeOnKillFlat on sword)
		const items = generateMany(300, {
			rarity: "legendary",
			templateId: "sword_t1",
			itemLevel: 80,
		});
		const rolledIds = allExplicitModIds(items);
		expect(rolledIds.has("lifeOnKillFlat")).toBe(true);
	});

	it("rare/magic items unchanged (standard random pool)", () => {
		const items = generateMany(300, {
			rarity: "rare",
			templateId: "sword_t1",
			itemLevel: 80,
		});
		const rolledIds = allExplicitModIds(items);
		// Filler mods should still appear on non-epic items
		expect(rolledIds.has("lifeOnKillFlat")).toBe(true);
	});
});

// ── getSynergyWeight unit tests ──

describe("getSynergyWeight", () => {
	// Import the exported function
	it("returns baseWeight when no rolled tags", () => {
		expect(getSynergyWeight(1000, ["attack", "physical"], new Set(), 3)).toBe(
			1000,
		);
	});

	it("returns baseWeight when multiplier is 0", () => {
		expect(getSynergyWeight(1000, ["attack"], new Set(["attack"]), 0)).toBe(
			1000,
		);
	});

	it("returns baseWeight when candidate has no tags", () => {
		expect(getSynergyWeight(1000, [], new Set(["attack"]), 3)).toBe(1000);
	});

	it("boosts weight by multiplier per matching tag", () => {
		// 1 match: 1000 * (1 + 3*1) = 4000
		expect(
			getSynergyWeight(1000, ["attack", "cold"], new Set(["attack"]), 3),
		).toBe(4000);
		// 2 matches: 1000 * (1 + 3*2) = 7000
		expect(
			getSynergyWeight(
				1000,
				["attack", "cold"],
				new Set(["attack", "cold"]),
				3,
			),
		).toBe(7000);
	});

	it("legendary multiplier is weaker", () => {
		// 2 matches: 1000 * (1 + 1.5*2) = 4000
		expect(
			getSynergyWeight(
				1000,
				["attack", "cold"],
				new Set(["attack", "cold"]),
				1.5,
			),
		).toBe(4000);
	});
});

// ── Tier system ──

describe("tier system", () => {
	it("low level items get lower tier values", () => {
		const lowItems = generateMany(100, {
			rarity: "rare",
			templateId: "sword_t1",
			itemLevel: 5,
		});
		const highItems = generateMany(100, {
			rarity: "rare",
			templateId: "sword_t1",
			itemLevel: 95,
		});

		const avgValue = (items: GeneratedItem[]) => {
			const values = items.flatMap((i) => i.explicits.map((m) => m.value));
			return values.length > 0
				? values.reduce((a, b) => a + b, 0) / values.length
				: 0;
		};

		expect(avgValue(highItems)).toBeGreaterThan(avgValue(lowItems));
	});
});

// ── Leather and silk armor defense ──

describe("leather armor defense", () => {
	it("leather armor localDefenseFlat description says Evasion Rating", () => {
		const items = generateMany(200, {
			rarity: "epic",
			templateId: "leather_chestplate_t1",
			itemLevel: 80,
		});
		for (const item of items) {
			const defMod = item.explicits.find(
				(m) => m.modifierId === "localDefenseFlat",
			);
			if (defMod) {
				expect(defMod.description).toContain("Evasion Rating");
				expect(defMod.description).not.toContain("Defense");
			}
		}
	});
});

describe("silk armor defense", () => {
	it("silk armor localDefenseFlat description says Barrier", () => {
		const items = generateMany(200, {
			rarity: "epic",
			templateId: "silk_chestplate_t1",
			itemLevel: 80,
		});
		for (const item of items) {
			const defMod = item.explicits.find(
				(m) => m.modifierId === "localDefenseFlat",
			);
			if (defMod) {
				expect(defMod.description).toContain("Barrier");
				expect(defMod.description).not.toContain("Defense");
			}
		}
	});
});

// ── Base tier selection by item level ──

describe("base tier selection by item level", () => {
	it("low item level only picks low-tier bases", () => {
		const items = generateMany(100, { rarity: "normal", itemLevel: 5 });
		for (const item of items) {
			const template = EQUIPMENT_TEMPLATES.find(
				(t) => t.id === item.templateId,
			);
			expect(template).toBeDefined();
			expect(template!.dropLevel).toBeLessThanOrEqual(5);
		}
	});

	it("high item level can pick high-tier bases", () => {
		const items = generateMany(200, { rarity: "normal", itemLevel: 83 });
		const templateIds = new Set(items.map((i) => i.templateId));
		const hasHighTier = [...templateIds].some(
			(id) => id.includes("_t21") || id.includes("_t20"),
		);
		expect(hasHighTier).toBe(true);
	});

	it("item level 1 only picks tier 1 bases", () => {
		const items = generateMany(100, { rarity: "normal", itemLevel: 1 });
		for (const item of items) {
			const template = EQUIPMENT_TEMPLATES.find(
				(t) => t.id === item.templateId,
			);
			expect(template).toBeDefined();
			expect(template!.dropLevel).toBe(1);
		}
	});
});

// ── Attribute requirements ──

describe("attribute requirements", () => {
	it("generated items carry requirements from template", () => {
		const item = generateItem({ rarity: "normal", templateId: "sword_t1" });
		expect(item.requirements).toBeDefined();
		expect(item.requirements!.level).toBe(1);
		expect(item.requirements!.str).toBe(10);
		expect(item.requirements!.dex).toBe(10);
	});

	it("high-tier weapon has higher attribute requirements", () => {
		const item = generateItem({ rarity: "normal", templateId: "sword_t21" });
		expect(item.requirements).toBeDefined();
		expect(item.requirements!.str).toBeGreaterThan(100);
		expect(item.requirements!.dex).toBeGreaterThan(100);
	});

	it("jewelry has no attribute requirements", () => {
		const item = generateItem({ rarity: "normal", templateId: "cobalt_ring" });
		expect(item.requirements).toBeDefined();
		expect(item.requirements!.str).toBeUndefined();
		expect(item.requirements!.dex).toBeUndefined();
		expect(item.requirements!.int).toBeUndefined();
	});

	it("plate armor requires str", () => {
		const item = generateItem({
			rarity: "normal",
			templateId: "plate_chestplate_t1",
		});
		expect(item.requirements!.str).toBeDefined();
		expect(item.requirements!.str).toBeGreaterThan(0);
	});

	it("leather armor requires dex", () => {
		const item = generateItem({
			rarity: "normal",
			templateId: "leather_chestplate_t1",
		});
		expect(item.requirements!.dex).toBeDefined();
		expect(item.requirements!.dex).toBeGreaterThan(0);
	});

	it("silk armor requires int", () => {
		const item = generateItem({
			rarity: "normal",
			templateId: "silk_chestplate_t1",
		});
		expect(item.requirements!.int).toBeDefined();
		expect(item.requirements!.int).toBeGreaterThan(0);
	});
});
