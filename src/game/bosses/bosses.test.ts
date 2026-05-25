import { describe, expect, it } from "vitest";
import { scaleMonsterStats } from "../monsters/scaling";
import { BOSSES, findBoss } from "./data";
import { GRALFOR } from "./gralfor";

describe("BOSSES registry", () => {
	it("findBoss returns Gralfor", () => {
		expect(findBoss("gralfor")).toBe(GRALFOR);
	});

	it("BossId union matches registry keys", () => {
		// Compile-time check that BossId covers BOSSES — runtime side ensures
		// we don't accidentally ship a registry entry with no BossId slot.
		const keys = Object.keys(BOSSES);
		for (const k of keys) {
			expect(findBoss(k as keyof typeof BOSSES)).not.toBeNull();
		}
	});
});

describe("Gralfor stat sheet", () => {
	it("scales HP, damage, and resistances at the declared level", () => {
		const scaled = scaleMonsterStats(GRALFOR.template, GRALFOR.level);
		// HP at lvl 17: 200 * 1.06^16 ≈ 508
		expect(scaled.hp).toBeGreaterThan(450);
		expect(scaled.hp).toBeLessThan(560);
		// Resistances flow through from the template — including the negative
		// cold value that expresses vulnerability (boss-only convention).
		expect(scaled.resistances.fire).toBe(50);
		expect(scaled.resistances.cold).toBe(-25);
		expect(scaled.resistances.lightning).toBe(0);
		expect(scaled.resistances.void).toBe(0);
		// Attack speed never scales — anchored to the template.
		expect(scaled.attackSpeed).toBe(0.9);
		// Phys + fire damage split mirrors the 50/50 design — both elements
		// should scale by the same factor so the split stays balanced.
		const phys = scaled.physicalDamage;
		const fire = scaled.elementalDamage.find((e) => e.element === "Fire");
		expect(fire).toBeDefined();
		expect(phys.min).toBe(fire?.min);
		expect(phys.max).toBe(fire?.max);
	});
});
