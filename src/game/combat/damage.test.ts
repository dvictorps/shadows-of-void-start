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
			universal: 0,
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
		brokenItemIds: new Set(),
		...overrides,
	};
}

function swing(args: Partial<SwingProfile> = {}): SwingProfile {
	return {
		source: "mainHand",
		itemId: "w1",
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

	it("applies armor mitigation to physical only", () => {
		const result = rollPlayerSwing({
			swing: swing({ physicalDamage: { min: 100, max: 100 } }),
			stats: statsAttack(),
			defender: { ...dummyDefender, armor: 100, level: 10 },
			random: () => 0.5,
		});
		// armor 100 vs level 10 → mitigation = 100/(100+100) = 50%
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
});

describe("rollEnemyAttack", () => {
	it("returns physical damage with no miss when defender has 0 evasion", () => {
		const result = rollEnemyAttack({
			def: {
				id: "test",
				name: "test",
				emoji: "x",
				baseStats: { hp: 1, attackSpeed: 1, minDamage: 10, maxDamage: 10 },
				xpReward: 0,
				allowedRarities: ["normal"],
			},
			enemyLevel: 1,
			defender: { ...dummyDefender, evasion: 0 },
			random: () => 0.0,
		});
		expect(result.amount).toBe(10);
		expect(result.isMiss).toBe(false);
	});

	it("armor reduces enemy physical hits", () => {
		const result = rollEnemyAttack({
			def: {
				id: "test",
				name: "test",
				emoji: "x",
				baseStats: { hp: 1, attackSpeed: 1, minDamage: 100, maxDamage: 100 },
				xpReward: 0,
				allowedRarities: ["normal"],
			},
			enemyLevel: 10,
			defender: { ...dummyDefender, armor: 100, level: 10 },
			random: () => 0.0,
		});
		expect(result.amount).toBe(50);
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
