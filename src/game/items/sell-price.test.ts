import { describe, expect, it } from "vitest";
import { computeSellPrice } from "./sell-price";
import type { GeneratedItem, RolledMod } from "./types";

function mod(tier: number): RolledMod {
	return {
		modifierId: "x",
		modifierName: "x",
		affixType: "prefix",
		modifierType: "flat",
		isGlobalStat: true,
		tier,
		value: 0,
		description: "",
	};
}

function item(overrides: Partial<GeneratedItem> = {}): GeneratedItem {
	return {
		id: "test",
		templateId: "tpl",
		templateName: "T",
		equipmentType: "weapon",
		rarity: "normal",
		name: "Test",
		itemLevel: 1,
		baseStats: {},
		implicits: [],
		explicits: [],
		...overrides,
	};
}

describe("computeSellPrice", () => {
	it("Normal ilvl 1 with no mods", () => {
		// 5 * (1 + 0.1) * (1 + 0) = 5.5 → 5
		expect(computeSellPrice(item({ rarity: "normal", itemLevel: 1 }))).toBe(5);
	});

	it("Magic ilvl 1 with two T10 mods", () => {
		// 20 * 1.1 * (1 + 2/10) = 26.4 → 26
		expect(
			computeSellPrice(
				item({
					rarity: "magic",
					itemLevel: 1,
					explicits: [mod(10), mod(10)],
				}),
			),
		).toBe(26);
	});

	it("Rare ilvl 1 with three T10 mods", () => {
		// 80 * 1.1 * (1 + 3/10) = 114.4 → 114
		expect(
			computeSellPrice(
				item({
					rarity: "rare",
					itemLevel: 1,
					explicits: [mod(10), mod(10), mod(10)],
				}),
			),
		).toBe(114);
	});

	it("Rare ilvl 80 with T3 / T4 / T2 mods (CONTEXT example)", () => {
		// 80 * (1 + 80/10) * (1 + (8 + 7 + 9) / 10) = 80 * 9 * 3.4 = 2448
		expect(
			computeSellPrice(
				item({
					rarity: "rare",
					itemLevel: 80,
					explicits: [mod(3), mod(4), mod(2)],
				}),
			),
		).toBe(2448);
	});

	it("Legendary T1 mods scale aggressively with ilvl", () => {
		// 400 * (1 + 100/10) * (1 + 5*10/10) = 400 * 11 * 6 = 26400
		const result = computeSellPrice(
			item({
				rarity: "legendary",
				itemLevel: 100,
				explicits: [mod(1), mod(1), mod(1), mod(1), mod(1)],
			}),
		);
		expect(result).toBe(26400);
	});
});
