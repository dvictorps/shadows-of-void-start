import { describe, expect, it } from "vitest";
import { estimateDps } from "./dps";
import type { ComputedCharacterStats, SwingProfile } from "./types";

// Authoritative DPS estimator — drives StatusCard and ShowStatsModal. These
// tests pin the formula's main paths so a future refactor can't silently
// drift the two readouts again.

function makeSwing(overrides: Partial<SwingProfile> = {}): SwingProfile {
	return {
		source: "mainHand",
		itemId: "test-weapon",
		weaponType: "sword",
		physicalDamage: { min: 10, max: 20 },
		elementalDamage: [],
		baseCritChance: 0,
		baseAttackSpeed: 1,
		...overrides,
	};
}

function makeStats(
	overrides: Partial<ComputedCharacterStats> = {},
): ComputedCharacterStats {
	return {
		attributes: { strength: 0, dexterity: 0, intelligence: 0 },
		maxLife: 100,
		lifeRegen: 0,
		maxMana: 0,
		manaRegen: 0,
		maxBarrier: 0,
		armor: 0,
		evasion: 0,
		accuracy: 0,
		blockChance: 0,
		thorns: 0,
		resistances: { cold: 0, fire: 0, lightning: 0, void: 0 },
		path: "attack",
		tickRate: 1,
		swings: [makeSwing()],
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
		brokenItemIds: new Set<string>(),
		...overrides,
	};
}

describe("estimateDps", () => {
	it("returns 0 when there are no swings (unarmed)", () => {
		expect(estimateDps(makeStats({ swings: [] }))).toBe(0);
	});

	it("multiplies avg per-swing damage by tickRate (no increased, no crit)", () => {
		const stats = makeStats({
			swings: [makeSwing({ physicalDamage: { min: 10, max: 20 } })],
			tickRate: 2,
		});
		// Avg per swing = 15; × tickRate 2 = 30.
		expect(estimateDps(stats)).toBe(30);
	});

	it("applies %increased physical and %increased melee additively on the attack path", () => {
		const stats = makeStats({
			swings: [makeSwing({ physicalDamage: { min: 10, max: 20 } })],
			tickRate: 1,
			increased: {
				...makeStats().increased,
				physical: 50,
				melee: 30,
			},
		});
		// 15 × (1 + (50 + 30)/100) = 15 × 1.8 = 27.
		expect(estimateDps(stats)).toBe(27);
	});

	it("includes crit factor (base 50% × crit chance) — the bug the modal had", () => {
		const stats = makeStats({
			swings: [makeSwing({ baseCritChance: 20 })],
			tickRate: 1,
		});
		// Avg 15 × tickRate 1 × (1 + 0.2 × 0.5) = 15 × 1.1 = 16.5 → round 17.
		expect(estimateDps(stats)).toBe(17);
	});

	it("crit factor scales with bonusCritMultiplier (mods above the +50% base)", () => {
		const stats = makeStats({
			swings: [makeSwing({ baseCritChance: 50 })],
			tickRate: 1,
			bonusCritMultiplier: 50, // base 50 + bonus 50 = 100% extra on crits.
		});
		// 15 × (1 + 0.5 × 1.0) = 15 × 1.5 = 22.5 → 23.
		expect(estimateDps(stats)).toBe(23);
	});

	it("scales elemental damage by per-element and global increased pools", () => {
		const stats = makeStats({
			swings: [
				makeSwing({
					physicalDamage: { min: 0, max: 0 },
					elementalDamage: [{ element: "fire", min: 10, max: 30 }],
				}),
			],
			tickRate: 1,
			increased: {
				...makeStats().increased,
				fire: 50,
				elementalGlobal: 25,
				elementalWithAttacks: 25,
				melee: 0,
			},
		});
		// Avg 20 × (1 + (50 + 25 + 25 + 0) / 100) = 20 × 2.0 = 40.
		expect(estimateDps(stats)).toBe(40);
	});

	it("applies gainAsExtraSpell only on the spell path", () => {
		const physOnly = makeStats({
			swings: [
				makeSwing({
					weaponType: "wand",
					physicalDamage: { min: 10, max: 30 },
					elementalDamage: [],
				}),
			],
			path: "spell",
			tickRate: 1,
			gainAsExtraSpell: { cold: 0, fire: 100, lightning: 0, void: 0 },
		});
		// On spell path: phys 20 + 20 × 1.0 (fire extra) = 40.
		expect(estimateDps(physOnly)).toBe(40);
	});

	it("averages damage across dual-wield swings before scaling", () => {
		const stats = makeStats({
			swings: [
				makeSwing({
					source: "mainHand",
					physicalDamage: { min: 10, max: 20 },
				}),
				makeSwing({
					source: "offHand",
					physicalDamage: { min: 30, max: 40 },
				}),
			],
			tickRate: 1,
		});
		// (15 + 35) / 2 = 25 per swing × tickRate 1 = 25.
		expect(estimateDps(stats)).toBe(25);
	});

	it("caps per-swing crit chance at 100 (no overflow with high +crit increased)", () => {
		const stats = makeStats({
			swings: [makeSwing({ baseCritChance: 50 })],
			tickRate: 1,
			increased: { ...makeStats().increased, criticalChance: 9000 },
		});
		// avgCrit clamps to 100%, factor = 1 + 1.0 × 0.5 = 1.5; 15 × 1.5 = 22.5 → 23.
		expect(estimateDps(stats)).toBe(23);
	});
});
