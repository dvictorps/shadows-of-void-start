import { describe, expect, it } from "vitest";

import { planNewCharacter } from "./new-character";

function plan(classId: string) {
	const result = planNewCharacter(
		{ name: "Hero", classId, hardcore: false },
		[],
	);
	if (!result.ok) throw new Error(result.error);
	return result.plan;
}

function gear(classId: string): string[] {
	return plan(classId)
		.starterItems.map(({ slot, item }) => `${slot}:${item.templateId}`)
		.toSorted((a, b) => a.localeCompare(b));
}

describe("planNewCharacter starter gear", () => {
	it("gives the mage a wand and a tier-1 tome", () => {
		expect(gear("mage")).toEqual(["offhand:tome_t1", "weapon:cracked_wand"]);
		const tome = plan("mage").starterItems.find((s) => s.slot === "offhand");
		expect(tome?.item.rarity).toBe("normal");
		expect(tome?.item.equipmentType).toBe("tome");
	});

	it("leaves the warrior and rogue kits unchanged", () => {
		expect(gear("warrior")).toEqual(["weapon:rusty_sword"]);
		expect(gear("rogue")).toEqual([
			"chestplate:leather_chestplate_t1",
			"weapon:rusty_dagger",
		]);
	});

	it("adds the tome's barrier to the level-1 mage", () => {
		const { stats } = plan("mage");
		expect(stats.cachedMaxBarrier).toBe(35);
	});
});
