import { EMPTY_ELEMENTAL_GAIN } from "#/game/combat/damage";
import type { Enemy } from "#/game/combat/types";
import type { MonsterDefinition } from "#/game/monsters/types";
import type { ComputedCharacterStats, SwingProfile } from "#/game/stats/types";

export type EnemyOverrides = Partial<Omit<Enemy, "scaled">> & {
	scaled?: Partial<Enemy["scaled"]>;
};

export function makeEnemy(
	currentHp: number,
	overrides: EnemyOverrides = {},
): Enemy {
	const def: MonsterDefinition = {
		id: "test-mob",
		name: "Test Mob",
		sprite: "x",
		pathColor: "#888888",
		baseStats: {
			hp: currentHp,
			attackSpeed: 20,
			physicalDamage: { min: 5, max: 5 },
			elementalDamage: [],
		},
		xpReward: 1,
		allowedRarities: ["normal"],
	};
	const { scaled: scaledOverrides, ...enemyOverrides } = overrides;
	return {
		def,
		currentHp,
		currentBarrier: 0,
		level: 1,
		rarity: "normal",
		mods: [],
		scaled: {
			level: 1,
			hp: currentHp,
			physicalDamage: { min: 5, max: 5 },
			elementalDamage: [],
			attackSpeed: 20,
			xpReward: 1,
			armor: 0,
			evasion: 0,
			accuracy: 1000,
			resistances: { cold: 0, fire: 0, lightning: 0, void: 0 },
			barrier: 0,
			criticalChance: 0,
			criticalMultiplier: 0,
			gainAsExtraDamage: { ...EMPTY_ELEMENTAL_GAIN },
			...scaledOverrides,
		},
		nameSeed: { primary: 0, secondary: 0, epithet: 0 },
		...enemyOverrides,
	};
}

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
