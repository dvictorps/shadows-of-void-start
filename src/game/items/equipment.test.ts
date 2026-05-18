import { describe, expect, it } from "vitest";
import { planEquip, validSlotsForItem } from "./equipment";
import type { GeneratedItem } from "./types";

function makeWeapon(
	id: string,
	weaponType: GeneratedItem["weaponType"],
): GeneratedItem {
	return {
		id,
		templateId: id,
		templateName: id,
		equipmentType: "weapon",
		weaponType,
		rarity: "normal",
		name: id,
		itemLevel: 1,
		baseStats: {},
		implicits: [],
		explicits: [],
	};
}

function makeShield(id: string): GeneratedItem {
	return {
		id,
		templateId: id,
		templateName: id,
		equipmentType: "offhand",
		rarity: "normal",
		name: id,
		itemLevel: 1,
		baseStats: {},
		implicits: [],
		explicits: [],
	};
}

function makeRing(id: string): GeneratedItem {
	return {
		id,
		templateId: id,
		templateName: id,
		equipmentType: "ring",
		rarity: "normal",
		name: id,
		itemLevel: 1,
		baseStats: {},
		implicits: [],
		explicits: [],
	};
}

describe("validSlotsForItem", () => {
	it("ring fits ring1 or ring2", () => {
		expect(validSlotsForItem(makeRing("r"))).toEqual(["ring1", "ring2"]);
	});

	it("shield only fits offhand", () => {
		expect(validSlotsForItem(makeShield("s"))).toEqual(["offhand"]);
	});

	it("1H attack weapon fits weapon or offhand", () => {
		expect(validSlotsForItem(makeWeapon("sw", "sword"))).toEqual([
			"weapon",
			"offhand",
		]);
	});

	it("2H weapon fits weapon only", () => {
		expect(validSlotsForItem(makeWeapon("gs", "greatsword"))).toEqual([
			"weapon",
		]);
		expect(validSlotsForItem(makeWeapon("staff", "staff"))).toEqual(["weapon"]);
	});

	it("1H caster (wand) fits weapon or offhand", () => {
		expect(validSlotsForItem(makeWeapon("w", "wand"))).toEqual([
			"weapon",
			"offhand",
		]);
	});
});

describe("planEquip", () => {
	it("equipping to an empty matching slot — no displacement", () => {
		const plan = planEquip({
			item: makeWeapon("sw", "sword"),
			targetSlot: "weapon",
			currentEquipped: [],
		});
		expect(plan.reject).toBeUndefined();
		expect(plan.displaced).toHaveLength(0);
	});

	it("equipping to occupied matching slot displaces the occupant", () => {
		const plan = planEquip({
			item: makeWeapon("sw2", "sword"),
			targetSlot: "weapon",
			currentEquipped: [{ slot: "weapon", item: makeWeapon("sw1", "sword") }],
		});
		expect(plan.displaced).toHaveLength(1);
		expect(plan.displaced[0].item.id).toBe("sw1");
	});

	it("rejects wrong slot type", () => {
		const plan = planEquip({
			item: makeRing("r"),
			targetSlot: "helmet",
			currentEquipped: [],
		});
		expect(plan.reject).toBe("wrong-slot");
	});

	it("equipping 2H to weapon slot displaces off-hand too", () => {
		const plan = planEquip({
			item: makeWeapon("gs", "greatsword"),
			targetSlot: "weapon",
			currentEquipped: [
				{ slot: "weapon", item: makeWeapon("sw", "sword") },
				{ slot: "offhand", item: makeShield("s") },
			],
		});
		expect(plan.displaced.map((d) => d.slot).sort()).toEqual([
			"offhand",
			"weapon",
		]);
	});

	it("equipping to off-hand while main hand is 2H displaces the 2H", () => {
		const plan = planEquip({
			item: makeShield("s"),
			targetSlot: "offhand",
			currentEquipped: [{ slot: "weapon", item: makeWeapon("gs", "greatsword") }],
		});
		expect(plan.displaced).toHaveLength(1);
		expect(plan.displaced[0].slot).toBe("weapon");
	});

	it("rejects mixed-archetype dual-wield (sword + wand)", () => {
		const plan = planEquip({
			item: makeWeapon("wand", "wand"),
			targetSlot: "offhand",
			currentEquipped: [{ slot: "weapon", item: makeWeapon("sw", "sword") }],
		});
		expect(plan.reject).toBe("mixed-archetype");
	});

	it("allows same-archetype dual-wield (sword + dagger)", () => {
		const plan = planEquip({
			item: makeWeapon("dg", "dagger"),
			targetSlot: "offhand",
			currentEquipped: [{ slot: "weapon", item: makeWeapon("sw", "sword") }],
		});
		expect(plan.reject).toBeUndefined();
		expect(plan.displaced).toHaveLength(0);
	});

	it("rejects equipping a weapon to off-hand with no main hand", () => {
		const plan = planEquip({
			item: makeWeapon("sw", "sword"),
			targetSlot: "offhand",
			currentEquipped: [],
		});
		expect(plan.reject).toBe("needs-main-hand");
	});

	it("allows a shield in off-hand even with no main hand", () => {
		const plan = planEquip({
			item: makeShield("s"),
			targetSlot: "offhand",
			currentEquipped: [],
		});
		expect(plan.reject).toBeUndefined();
	});

	it("ring1 and ring2 are independent", () => {
		const r1 = planEquip({
			item: makeRing("r2"),
			targetSlot: "ring1",
			currentEquipped: [{ slot: "ring2", item: makeRing("r1") }],
		});
		expect(r1.reject).toBeUndefined();
		expect(r1.displaced).toHaveLength(0);
	});
});
