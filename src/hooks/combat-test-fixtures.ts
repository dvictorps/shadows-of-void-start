// Shared fixtures for the combat hook tests (useCombatTick, useCombatLoop).

import type { ComputedCharacterStats, SwingProfile } from "#/game/stats/types";

/** A level-1 attacker: one 10-damage sword swing per 50ms tick, no defenses. */
export function makeStats(
	overrides: Partial<ComputedCharacterStats> = {},
): ComputedCharacterStats {
	const swing: SwingProfile = {
		source: "mainHand",
		itemId: "test-weapon",
		weaponType: "sword",
		physicalDamage: { min: 10, max: 10 },
		elementalDamage: [],
		baseCritChance: 0,
		baseAttackSpeed: 1,
	};
	return {
		attributes: { strength: 10, dexterity: 10, intelligence: 10 },
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
		// 20 swings/sec × 50ms tick = exactly 1.0 progress per tick, so both
		// player + enemy swings fire on the first tick after activation.
		tickRate: 20,
		swings: [swing],
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
