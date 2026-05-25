import { describe, expect, it } from "vitest";
import type { ComputedCharacterStats, SwingProfile } from "../stats/types";
import {
	applyDamageToBarrierThenLife,
	rollEnemyAttack,
	rollPlayerSwing,
} from "./damage";

function statsAttack(
	overrides: Partial<ComputedCharacterStats> = {},
): ComputedCharacterStats {
	return {
		attributes: { strength: 10, dexterity: 5, intelligence: 5 },
		maxLife: 100,
		lifeRegen: 0,
		maxMana: 0,
		manaRegen: 0,
		maxBarrier: 0,
		armor: 0,
		evasion: 0,
		accuracy: 1000,
		blockChance: 0,
		thorns: 0,
		resistances: { cold: 0, fire: 0, lightning: 0, void: 0 },
		path: "attack",
		tickRate: 1,
		swings: [],
		increased: {
			physical: 0,
			cold: 0,
			fire: 0,
			lightning: 0,
			void: 0,
			elementalGlobal: 0,
			elementalWithAttacks: 0,
			melee: 0,
			spell: 0,
			attackSpeed: 0,
			castSpeed: 0,
			criticalChance: 0,
		},
		bonusCritMultiplier: 0,
		movementSpeed: 0,
		lifeGainOnHit: 0,
		manaGainOnHit: 0,
		lifeOnKill: 0,
		manaOnKill: 0,
		lifeLeechPercent: 0,
		magicFind: 0,
		gainAsExtraSpell: { cold: 0, fire: 0, lightning: 0, void: 0 },
		brokenItemIds: new Set(),
		...overrides,
	};
}

function swing(args: Partial<SwingProfile> = {}): SwingProfile {
	return {
		source: "mainHand",
		itemId: "w1",
		weaponType: "sword",
		physicalDamage: { min: 10, max: 10 },
		elementalDamage: [],
		baseCritChance: 0,
		baseAttackSpeed: 1.0,
		...args,
	};
}

const dummyDefender = {
	armor: 0,
	evasion: 0,
	accuracy: 0,
	level: 1,
	resistances: { cold: 0, fire: 0, lightning: 0, void: 0 },
};

describe("rollPlayerSwing", () => {
	it("returns physical damage from the swing's range, no crit, no miss", () => {
		const result = rollPlayerSwing({
			swing: swing(),
			stats: statsAttack(),
			defender: dummyDefender,
			random: () => 0.5, // never crits, never misses
		});
		expect(result.isMiss).toBe(false);
		expect(result.isCrit).toBe(false);
		expect(result.amount).toBe(10);
		expect(result.breakdown.physical).toBe(10);
	});

	it("applies physical increased pool", () => {
		const result = rollPlayerSwing({
			swing: swing(),
			stats: statsAttack({
				increased: { ...statsAttack().increased, physical: 50 },
			}),
			defender: dummyDefender,
			random: () => 0.5,
		});
		expect(result.amount).toBe(15); // 10 × 1.5
	});

	it("applies armor mitigation to physical only (PoE hit-size formula)", () => {
		const result = rollPlayerSwing({
			swing: swing({ physicalDamage: { min: 100, max: 100 } }),
			stats: statsAttack(),
			defender: { ...dummyDefender, armor: 1000 },
			random: () => 0.5,
		});
		// armor 1000 vs 100-damage hit → reduction = 1000/(1000+1000) = 50%
		expect(result.amount).toBe(50);
	});

	it("crit multiplies the post-increase damage", () => {
		const result = rollPlayerSwing({
			swing: swing({ baseCritChance: 100 }), // always crits
			stats: statsAttack(),
			defender: dummyDefender,
			random: (() => {
				let calls = 0;
				return () => {
					calls += 1;
					// First call (hit check) succeeds; second call (crit check) succeeds.
					return calls === 1 ? 0.0 : 0.0;
				};
			})(),
		});
		expect(result.isCrit).toBe(true);
		// base 10 × crit (1 + 50/100) = 15
		expect(result.amount).toBe(15);
	});

	it("misses when hitChance is low", () => {
		const result = rollPlayerSwing({
			swing: swing(),
			stats: statsAttack({ accuracy: 0 }),
			defender: { ...dummyDefender, evasion: 1000 },
			random: () => 0.5, // 0.5 > clamped hit chance (=0.05)
		});
		expect(result.isMiss).toBe(true);
		expect(result.amount).toBe(0);
	});

	it("spell path always lands — accuracy/evasion gate bypassed", () => {
		const result = rollPlayerSwing({
			swing: swing({
				physicalDamage: { min: 0, max: 0 },
				elementalDamage: [{ element: "Cold", min: 50, max: 50 }],
			}),
			// Zero accuracy + huge defender evasion would miss on attack path,
			// but spell path skips the check entirely.
			stats: statsAttack({ path: "spell", accuracy: 0 }),
			defender: { ...dummyDefender, evasion: 10000 },
			random: () => 0.99,
		});
		expect(result.isMiss).toBe(false);
		expect(result.amount).toBe(50);
	});

	it("applies elemental resistance per element", () => {
		const result = rollPlayerSwing({
			swing: swing({
				physicalDamage: { min: 0, max: 0 },
				elementalDamage: [{ element: "Fire", min: 100, max: 100 }],
			}),
			stats: statsAttack(),
			defender: {
				...dummyDefender,
				resistances: { cold: 0, fire: 50, lightning: 0, void: 0 },
			},
			random: () => 0.5,
		});
		expect(result.amount).toBe(50); // 100 × (1 - 0.5)
	});

	it("gain-as-extra fires on spell path: adds element chunks from spell damage total", () => {
		// 100 base cold damage. Tome grants "+20% as extra Fire". Fire chunk =
		// 100 × 0.20 = 20 → total 120 (50 base + 20 extra... wait 100 base cold).
		// Total = cold(100) + fire(20) = 120.
		const result = rollPlayerSwing({
			swing: swing({
				physicalDamage: { min: 0, max: 0 },
				elementalDamage: [{ element: "Cold", min: 100, max: 100 }],
			}),
			stats: statsAttack({
				path: "spell",
				gainAsExtraSpell: { cold: 0, fire: 20, lightning: 0, void: 0 },
			}),
			defender: dummyDefender,
			random: () => 0.5,
		});
		expect(result.amount).toBe(120);
		expect(result.breakdown.cold).toBe(100);
		expect(result.breakdown.fire).toBe(20);
	});

	it("gain-as-extra reads post-increased spell damage total", () => {
		// 50 base fire damage. +100% increased fire → fire becomes 100. Tome
		// grants "+10% as extra Cold". Cold chunk = 100 × 0.10 = 10.
		const result = rollPlayerSwing({
			swing: swing({
				physicalDamage: { min: 0, max: 0 },
				elementalDamage: [{ element: "Fire", min: 50, max: 50 }],
			}),
			stats: statsAttack({
				path: "spell",
				increased: { ...statsAttack().increased, fire: 100 },
				gainAsExtraSpell: { cold: 10, fire: 0, lightning: 0, void: 0 },
			}),
			defender: dummyDefender,
			random: () => 0.5,
		});
		expect(result.amount).toBe(110);
		expect(result.breakdown.fire).toBe(100);
		expect(result.breakdown.cold).toBe(10);
	});

	it("gain-as-extra extra chunks are mitigated by the target's resistance for that element", () => {
		// 100 cold spell damage. +20% as extra fire → 20 fire. Defender has
		// 50% fire resist → fire chunk halved to 10. Cold has 0 resist.
		const result = rollPlayerSwing({
			swing: swing({
				physicalDamage: { min: 0, max: 0 },
				elementalDamage: [{ element: "Cold", min: 100, max: 100 }],
			}),
			stats: statsAttack({
				path: "spell",
				gainAsExtraSpell: { cold: 0, fire: 20, lightning: 0, void: 0 },
			}),
			defender: {
				...dummyDefender,
				resistances: { cold: 0, fire: 50, lightning: 0, void: 0 },
			},
			random: () => 0.5,
		});
		expect(result.breakdown.fire).toBe(10);
		expect(result.amount).toBe(110);
	});

	it("gain-as-extra does NOT fire on attack path", () => {
		const result = rollPlayerSwing({
			swing: swing({
				physicalDamage: { min: 0, max: 0 },
				elementalDamage: [{ element: "Cold", min: 100, max: 100 }],
			}),
			stats: statsAttack({
				path: "attack",
				gainAsExtraSpell: { cold: 0, fire: 50, lightning: 0, void: 0 },
			}),
			defender: dummyDefender,
			random: () => 0.5,
		});
		expect(result.breakdown.fire).toBe(0);
		expect(result.amount).toBe(100);
	});
});

describe("rollEnemyAttack", () => {
	// Most tests opt out of crit (enemyCriticalChance: 0) so the deterministic
	// random: () => 0.0 doesn't accidentally roll a crit and bump the
	// expected amount. Crit-specific tests below cover the crit path.
	it("returns physical damage with no miss when defender has 0 evasion", () => {
		const result = rollEnemyAttack({
			enemyAccuracy: 10,
			physicalDamage: { min: 10, max: 10 },
			elementalDamage: [],
			defender: { ...dummyDefender, evasion: 0 },
			enemyCriticalChance: 0,
			random: () => 0.0,
		});
		expect(result.amount).toBe(10);
		expect(result.breakdown.physical).toBe(10);
		expect(result.isMiss).toBe(false);
	});

	it("armor reduces enemy physical hits (PoE hit-size formula)", () => {
		const result = rollEnemyAttack({
			enemyAccuracy: 100,
			physicalDamage: { min: 100, max: 100 },
			elementalDamage: [],
			defender: { ...dummyDefender, armor: 1000 },
			enemyCriticalChance: 0,
			random: () => 0.0,
		});
		// 1000 armor vs 100-damage hit → 1000/(1000+1000) = 50% reduction
		expect(result.amount).toBe(50);
	});

	it("applies per-element resistance to elemental damage", () => {
		const result = rollEnemyAttack({
			enemyAccuracy: 10,
			physicalDamage: { min: 0, max: 0 },
			elementalDamage: [{ element: "Fire", min: 100, max: 100 }],
			defender: {
				...dummyDefender,
				resistances: { cold: 0, fire: 50, lightning: 0, void: 0 },
			},
			enemyCriticalChance: 0,
			random: () => 0.0,
		});
		// armor doesn't touch elements; 50% fire resist halves the hit
		expect(result.amount).toBe(50);
		expect(result.breakdown.fire).toBe(50);
		expect(result.breakdown.physical).toBe(0);
	});

	it("sums hybrid physical + elemental damage", () => {
		const result = rollEnemyAttack({
			enemyAccuracy: 10,
			physicalDamage: { min: 20, max: 20 },
			elementalDamage: [{ element: "Cold", min: 30, max: 30 }],
			defender: { ...dummyDefender },
			enemyCriticalChance: 0,
			random: () => 0.0,
		});
		expect(result.amount).toBe(50);
		expect(result.breakdown.physical).toBe(20);
		expect(result.breakdown.cold).toBe(30);
	});

	it("rolls block when defender carries blockChance — blocked hit deals zero damage", () => {
		const result = rollEnemyAttack({
			enemyAccuracy: 10,
			physicalDamage: { min: 50, max: 50 },
			elementalDamage: [],
			defender: { ...dummyDefender, blockChance: 75 },
			// First call (hit check) succeeds; second call (block roll: 0 < 75) blocks.
			random: (() => {
				let calls = 0;
				return () => {
					calls += 1;
					return calls === 1 ? 0.0 : 0.0;
				};
			})(),
		});
		expect(result.isBlocked).toBe(true);
		expect(result.isMiss).toBe(false);
		expect(result.amount).toBe(0);
	});

	it("does not block when block roll exceeds blockChance", () => {
		const result = rollEnemyAttack({
			enemyAccuracy: 10,
			physicalDamage: { min: 50, max: 50 },
			elementalDamage: [],
			defender: { ...dummyDefender, blockChance: 25 },
			enemyCriticalChance: 0,
			// Hit succeeds; block roll: 0.99 * 100 = 99 ≥ 25 → no block.
			random: (() => {
				let calls = 0;
				return () => {
					calls += 1;
					return calls === 1 ? 0.0 : 0.99;
				};
			})(),
		});
		expect(result.isBlocked).toBe(false);
		expect(result.amount).toBe(50);
	});

	it("crits multiply phys + elemental damage by (1 + multi/100)", () => {
		const result = rollEnemyAttack({
			enemyAccuracy: 10,
			physicalDamage: { min: 100, max: 100 },
			elementalDamage: [{ element: "Fire", min: 60, max: 60 }],
			defender: { ...dummyDefender },
			enemyCriticalChance: 100, // guaranteed crit
			enemyCriticalMultiplier: 50, // +50% → 1.5×
			random: () => 0.0,
		});
		expect(result.isCrit).toBe(true);
		// 100 phys × 1.5 = 150, 60 fire × 1.5 = 90 → total 240.
		expect(result.breakdown.physical).toBe(150);
		expect(result.breakdown.fire).toBe(90);
		expect(result.amount).toBe(240);
	});

	it("crit chance 0 never crits regardless of random roll", () => {
		const result = rollEnemyAttack({
			enemyAccuracy: 10,
			physicalDamage: { min: 50, max: 50 },
			elementalDamage: [],
			defender: { ...dummyDefender },
			enemyCriticalChance: 0,
			enemyCriticalMultiplier: 200,
			random: () => 0.0, // would crit with any non-zero chance
		});
		expect(result.isCrit).toBe(false);
		expect(result.amount).toBe(50);
	});

	it("gain-as-extra adds a % of total damage to the matching element", () => {
		// 100 phys × 30% = 30 extra void. Resistance 0%, no crit → total 130.
		const result = rollEnemyAttack({
			enemyAccuracy: 100,
			physicalDamage: { min: 100, max: 100 },
			elementalDamage: [],
			defender: { ...dummyDefender },
			enemyCriticalChance: 0,
			enemyGainAsExtra: { cold: 0, fire: 0, lightning: 0, void: 30 },
			random: () => 0.0,
		});
		expect(result.breakdown.physical).toBe(100);
		expect(result.breakdown.void).toBe(30);
		expect(result.amount).toBe(130);
	});

	it("gain-as-extra is resisted by the matching element resistance", () => {
		// 100 phys + 30 void as extra. 75% void res → void reduces to 7.5 (floor 7).
		const result = rollEnemyAttack({
			enemyAccuracy: 100,
			physicalDamage: { min: 100, max: 100 },
			elementalDamage: [],
			defender: {
				...dummyDefender,
				resistances: { cold: 0, fire: 0, lightning: 0, void: 75 },
			},
			enemyCriticalChance: 0,
			enemyGainAsExtra: { cold: 0, fire: 0, lightning: 0, void: 30 },
			random: () => 0.0,
		});
		expect(result.breakdown.physical).toBe(100);
		expect(result.breakdown.void).toBe(7);
		expect(result.amount).toBe(107);
	});

	it("gain-as-extra references pre-conversion total — two stacks don't compound", () => {
		// 100 phys, 30% cold + 30% fire = 30 cold + 30 fire (both off the same
		// 100 base, NOT 30% of the 130 after the first add).
		const result = rollEnemyAttack({
			enemyAccuracy: 100,
			physicalDamage: { min: 100, max: 100 },
			elementalDamage: [],
			defender: { ...dummyDefender },
			enemyCriticalChance: 0,
			enemyGainAsExtra: { cold: 30, fire: 30, lightning: 0, void: 0 },
			random: () => 0.0,
		});
		expect(result.breakdown.cold).toBe(30);
		expect(result.breakdown.fire).toBe(30);
		expect(result.amount).toBe(160);
	});

	it("baseline crit chance fires when defaults are used (5% floor)", () => {
		// random() * 100 < 5 → 0.04 fires crit, 0.06 does not.
		const r1 = rollEnemyAttack({
			enemyAccuracy: 100,
			physicalDamage: { min: 50, max: 50 },
			elementalDamage: [],
			defender: { ...dummyDefender },
			random: () => 0.04,
		});
		expect(r1.isCrit).toBe(true);
		// 50 × 1.5 (default 50% multiplier) = 75.
		expect(r1.amount).toBe(75);

		const r2 = rollEnemyAttack({
			enemyAccuracy: 100,
			physicalDamage: { min: 50, max: 50 },
			elementalDamage: [],
			defender: { ...dummyDefender },
			random: () => 0.06,
		});
		expect(r2.isCrit).toBe(false);
		expect(r2.amount).toBe(50);
	});
});

describe("applyDamageToBarrierThenLife", () => {
	it("absorbs damage on the barrier first", () => {
		const r = applyDamageToBarrierThenLife(30, 50, 100);
		expect(r.newBarrier).toBe(20);
		expect(r.newLife).toBe(100);
		expect(r.barrierAbsorbed).toBe(30);
		expect(r.lifeLost).toBe(0);
		expect(r.barrierJustEmptied).toBe(false);
	});

	it("overflows to life when barrier empties this hit", () => {
		const r = applyDamageToBarrierThenLife(80, 50, 100);
		expect(r.newBarrier).toBe(0);
		expect(r.newLife).toBe(70);
		expect(r.barrierJustEmptied).toBe(true);
	});

	it("hits life directly when barrier is already 0", () => {
		const r = applyDamageToBarrierThenLife(40, 0, 100);
		expect(r.newBarrier).toBe(0);
		expect(r.newLife).toBe(60);
		expect(r.barrierJustEmptied).toBe(false);
	});

	it("zero damage is a no-op", () => {
		const r = applyDamageToBarrierThenLife(0, 50, 100);
		expect(r.newBarrier).toBe(50);
		expect(r.newLife).toBe(100);
	});
});
