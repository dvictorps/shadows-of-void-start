import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { overwriteGetLocale } from "#/paraglide/runtime";
import { translateItemName, translateTemplateName } from "./item-name";
import type { GeneratedItem, RolledMod } from "./types";

const ORIGINAL_LOCALE_GETTER = () => "pt" as const;

afterEach(() => {
	overwriteGetLocale(ORIGINAL_LOCALE_GETTER);
});

function makeItem(overrides: Partial<GeneratedItem> = {}): GeneratedItem {
	return {
		id: "00000000-0000-0000-0000-000000000001",
		templateId: "sword_t1",
		nameBase: "sword",
		nameModifier: "iron",
		equipmentType: "weapon",
		weaponType: "sword",
		rarity: "normal",
		itemLevel: 1,
		baseStats: {},
		implicits: [],
		explicits: [],
		...overrides,
	};
}

function rolledMod(
	modifierId: string,
	affixType: "prefix" | "suffix",
): RolledMod {
	return {
		modifierId,
		affixType,
		modifierType: affixType === "prefix" ? "flat" : "increased",
		isGlobalStat: false,
		tier: 5,
		value: 10,
		description: "",
	};
}

describe("translateItemName", () => {
	describe("normal items", () => {
		beforeEach(() => overwriteGetLocale(() => "en"));

		it("EN composes <modifier> <base>", () => {
			expect(translateItemName(makeItem())).toBe("Iron Sword");
		});

		it("EN handles compound bases verbatim", () => {
			const helmet = makeItem({
				templateId: "plate_helmet_t1",
				nameBase: "plate_helm",
				equipmentType: "helmet",
			});
			expect(translateItemName(helmet)).toBe("Iron Plate Helm");
		});

		it("EN handles tier 21 void compound bases", () => {
			const t21 = makeItem({
				templateId: "leather_helmet_t21",
				nameBase: "void_touched_leather_hood",
				nameModifier: null,
				equipmentType: "helmet",
			});
			expect(translateItemName(t21)).toBe("Void-Touched Leather Hood");
		});
	});

	describe("PT — gender concord", () => {
		beforeEach(() => overwriteGetLocale(() => "pt"));

		it("composes <base> <modifier> with feminine concord", () => {
			// hallowed is { m: Sagrado, f: Sagrada }; sword.gender = f.
			expect(translateItemName(makeItem({ nameModifier: "hallowed" }))).toBe(
				"Espada Sagrada",
			);
		});

		it("uses masculine form when base is masculine", () => {
			// Same modifier on an Elmo (Plate Helm, gender m) → "Sagrado".
			const helmet = makeItem({
				templateId: "plate_helmet_t14",
				nameBase: "plate_helm",
				nameModifier: "hallowed",
				equipmentType: "helmet",
			});
			expect(translateItemName(helmet)).toBe("Elmo de Placas Sagrado");
		});

		it("invariant phrase modifiers don't inflect", () => {
			// "de Ferro" stays the same regardless of base gender.
			expect(translateItemName(makeItem())).toBe("Espada de Ferro");
		});

		it("renders void_touched as a gendered adjective", () => {
			// User decision: void_touched is "Maculado/Maculada pelo Vazio".
			const sword = makeItem({ nameModifier: "void_touched" });
			expect(translateItemName(sword)).toBe("Espada Maculada pelo Vazio");
			const cleaver = makeItem({
				templateId: "axe_t21",
				nameBase: "cleaver",
				nameModifier: "void_touched",
				equipmentType: "weapon",
				weaponType: "axe",
			});
			expect(translateItemName(cleaver)).toBe("Cutelo Maculado pelo Vazio");
		});
	});

	describe("magic items — affix composition", () => {
		const heavyAffix = rolledMod("physicalDamageFlat", "prefix");
		const swiftnessAffix = rolledMod("attackSpeedIncrease", "suffix");

		it("EN: prefix base suffix", () => {
			overwriteGetLocale(() => "en");
			const item = makeItem({
				rarity: "magic",
				explicits: [heavyAffix, swiftnessAffix],
			});
			expect(translateItemName(item)).toBe("Heavy Iron Sword of Swiftness");
		});

		it("PT: base prefix-gendered suffix", () => {
			overwriteGetLocale(() => "pt");
			const item = makeItem({
				rarity: "magic",
				explicits: [heavyAffix, swiftnessAffix],
			});
			expect(translateItemName(item)).toBe("Espada de Ferro Pesada da Rapidez");
		});

		it("PT: only-prefix item still composes correctly", () => {
			overwriteGetLocale(() => "pt");
			const item = makeItem({
				rarity: "magic",
				explicits: [heavyAffix],
			});
			expect(translateItemName(item)).toBe("Espada de Ferro Pesada");
		});

		it("PT: only-suffix item still composes correctly", () => {
			overwriteGetLocale(() => "pt");
			const item = makeItem({
				rarity: "magic",
				explicits: [swiftnessAffix],
			});
			expect(translateItemName(item)).toBe("Espada de Ferro da Rapidez");
		});
	});

	describe("rare/legendary/epic — UUID-seeded proper names", () => {
		it("rare items produce a two-word proper name", () => {
			overwriteGetLocale(() => "en");
			const item = makeItem({ rarity: "rare" });
			const name = translateItemName(item);
			expect(name.split(" ").length).toBe(2);
		});

		it("same UUID + same locale → same name (deterministic)", () => {
			overwriteGetLocale(() => "en");
			const item = makeItem({ rarity: "rare", id: "abc-123-def" });
			expect(translateItemName(item)).toBe(translateItemName(item));
		});

		it("different UUIDs produce different names (typically)", () => {
			overwriteGetLocale(() => "en");
			const a = makeItem({ rarity: "rare", id: "uuid-a" });
			const b = makeItem({ rarity: "rare", id: "uuid-b-completely-different" });
			// Two arbitrary distinct UUIDs aren't guaranteed to collide on pool
			// indices — assert the names are distinct in this specific sample.
			expect(translateItemName(a)).not.toBe(translateItemName(b));
		});

		it("locale switch flips the proper name to the equivalent slot", () => {
			const item = makeItem({ rarity: "rare", id: "abc-123" });
			overwriteGetLocale(() => "en");
			const en = translateItemName(item);
			overwriteGetLocale(() => "pt");
			const pt = translateItemName(item);
			expect(en).not.toBe(pt);
			// Both should be two-word.
			expect(en.split(" ").length).toBe(2);
			// PT pool entries are PRIMEIRO + "da/do X" — second word starts with
			// the article. (Smoke-check that the PT pool is being read, not EN.)
			expect(pt).toMatch(/^[A-Z]\S+ d[oae]s?\s\S+/);
		});

		it("translateTemplateName returns the base composition, not the proper name", () => {
			overwriteGetLocale(() => "pt");
			const item = makeItem({ rarity: "rare", id: "abc-123" });
			expect(translateTemplateName(item)).toBe("Espada de Ferro");
		});

		it("legendary + epic also produce a proper name (same code path)", () => {
			overwriteGetLocale(() => "en");
			expect(
				translateItemName(makeItem({ rarity: "legendary", id: "L1" })).split(
					" ",
				).length,
			).toBe(2);
			expect(
				translateItemName(makeItem({ rarity: "epic", id: "E1" })).split(" ")
					.length,
			).toBe(2);
		});
	});

	describe("fallback behavior", () => {
		beforeEach(() => overwriteGetLocale(() => "en"));

		it("unknown nameBase returns the templateId", () => {
			const item = makeItem({
				templateId: "weird_template",
				nameBase: "nonsense_base",
				nameModifier: null,
			});
			expect(translateItemName(item)).toBe("weird_template");
		});

		it("missing nameBase (legacy item) returns the templateId", () => {
			const item = makeItem({
				templateId: "legacy_item_xyz",
				nameBase: undefined,
				nameModifier: undefined,
			});
			expect(translateItemName(item)).toBe("legacy_item_xyz");
		});

		it("unknown modifier yields the base name alone", () => {
			const item = makeItem({ nameModifier: "made_up_modifier" });
			expect(translateItemName(item)).toBe("Sword");
		});
	});
});
