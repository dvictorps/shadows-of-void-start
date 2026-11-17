import { describe, expect, it } from "vitest";

import { findBoss } from "../bosses/data";
import { findMonster } from "../monsters/data";
import { scaleMonsterStats } from "../monsters/scaling";
import { resolveKillTarget, type KillClaim } from "./record-kill";

const IN_FOREST = { level: 30, currentLocation: "forest_profunda" };
const IN_LAIR = { level: 30, currentLocation: "covil_gralfor" };

function goblin(claim: Partial<KillClaim>): KillClaim {
	return {
		monsterId: "goblin",
		monsterLevel: 2,
		monsterRarity: "normal",
		...claim,
	};
}

function targetOf(
	claim: KillClaim,
	character: { level: number; currentLocation: string },
) {
	const result = resolveKillTarget(claim, character);
	if (!result.ok) throw new Error(result.error);
	return result.target;
}

describe("resolveKillTarget", () => {
	it.each([
		[2, 2],
		[1, 1],
		[3, 3],
		[999, 3],
		[0, 1],
		[-50, 1],
		[2.9, 2],
	])(
		"clamps a claimed level %s to %s in a zone of level 2 (zone level ± 1)",
		(claimed, level) => {
			expect(
				targetOf(goblin({ monsterLevel: claimed }), IN_FOREST).monsterLevel,
			).toBe(level);
		},
	);

	it("pays the XP of the clamped level, not the claimed one", () => {
		const template = findMonster("goblin");
		if (!template) throw new Error("goblin missing");
		expect(targetOf(goblin({ monsterLevel: 999 }), IN_FOREST).xpReward).toBe(
			scaleMonsterStats(template, 3).xpReward,
		);
	});

	it("bands around the character's level outside a levelled zone", () => {
		expect(
			targetOf(goblin({ monsterLevel: 999 }), {
				level: 4,
				currentLocation: "city",
			}).monsterLevel,
		).toBe(5);
	});

	it("keeps a normal, magic or rare claim for a regular monster", () => {
		for (const monsterRarity of ["normal", "magic", "rare"] as const) {
			expect(targetOf(goblin({ monsterRarity }), IN_FOREST).monsterRarity).toBe(
				monsterRarity,
			);
		}
	});

	it("refuses a regular monster claimed as unique", () => {
		expect(
			resolveKillTarget(goblin({ monsterRarity: "unique" }), IN_FOREST),
		).toEqual({ ok: false, error: "Invalid kill: goblin as unique" });
	});

	it("fixes a boss kill at the boss's own level and rarity, inside its lair", () => {
		const boss = findBoss("gralfor");
		const target = targetOf(
			{ monsterId: "gralfor", monsterLevel: 999, monsterRarity: "normal" },
			IN_LAIR,
		);
		expect(target.monsterLevel).toBe(boss?.level);
		expect(target.monsterRarity).toBe("unique");
	});

	it("refuses a boss kill outside its lair", () => {
		expect(
			resolveKillTarget(
				{ monsterId: "gralfor", monsterLevel: 17, monsterRarity: "unique" },
				IN_FOREST,
			),
		).toEqual({ ok: false, error: "Invalid kill: gralfor as unique" });
	});

	it("refuses an unknown monster", () => {
		expect(
			resolveKillTarget(goblin({ monsterId: "dragon" }), IN_FOREST),
		).toEqual({ ok: false, error: "Unknown monster: dragon" });
	});
});
