import { describe, expect, it } from "vitest";

import { scaleMonsterStats } from "../monsters/scaling";
import { typedKeys } from "../typed-object";
import { BOSSES, findBoss } from "./data";
import { GRALFOR } from "./gralfor";

describe("BOSSES registry", () => {
	it("findBoss returns Gralfor", () => {
		expect(findBoss("gralfor")).toBe(GRALFOR);
	});

	it("BossId union matches registry keys", () => {
		for (const k of typedKeys(BOSSES)) {
			expect(findBoss(k)).not.toBeNull();
		}
	});
});

describe("Gralfor stat sheet", () => {
	it("scales HP, damage, and resistances at the declared level", () => {
		const scaled = scaleMonsterStats(GRALFOR.template, GRALFOR.level);
		expect(scaled.hp).toBeGreaterThan(700);
		expect(scaled.hp).toBeLessThan(830);
		expect(scaled.resistances.fire).toBe(50);
		expect(scaled.resistances.cold).toBe(-25);
		expect(scaled.resistances.lightning).toBe(0);
		expect(scaled.resistances.void).toBe(0);
		expect(scaled.attackSpeed).toBe(0.9);
		const phys = scaled.physicalDamage;
		const fire = scaled.elementalDamage.find((e) => e.element === "Fire");
		expect(fire).toBeDefined();
		expect(phys.min).toBe(fire?.min);
		expect(phys.max).toBe(fire?.max);
	});
});
