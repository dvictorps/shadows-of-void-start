import type { CharacterClassDefinition } from "../classes/types";

/**
 * XP required to advance from `level` to `level + 1`. Linear curve.
 * Level 1→2 costs 100 XP; level 2→3 costs 200; etc.
 */
export function xpToNextLevel(level: number): number {
	return Math.max(1, level) * 100;
}

/**
 * Maximum HP for a character at a given level. For MVP: class base HP
 * plus a flat +10 per level beyond 1. No gear contribution yet.
 */
export function computeMaxHp(
	classDef: CharacterClassDefinition | null,
	level: number,
): number {
	const baseHp = classDef?.baseStats.hp ?? 50;
	const levelBonus = Math.max(0, level - 1) * 10;
	return baseHp + levelBonus;
}

/**
 * Apply an XP gain, levelling up as many times as the curve allows. Returns
 * the new level and xp values (xp resets to 0 each time we cross a threshold,
 * carrying over any surplus).
 */
export function applyXpGain(
	currentLevel: number,
	currentXp: number,
	amount: number,
	levelCap = 100,
): { level: number; xp: number; levelsGained: number } {
	let level = currentLevel;
	let xp = currentXp + amount;
	let levelsGained = 0;
	while (level < levelCap && xp >= xpToNextLevel(level)) {
		xp -= xpToNextLevel(level);
		level += 1;
		levelsGained += 1;
	}
	if (level >= levelCap) xp = 0;
	return { level, xp, levelsGained };
}

/**
 * Apply the death XP penalty. Currently a flat 5% of current XP within the
 * level. Floored at 0 — death never demotes the character.
 */
export function applyDeathXpPenalty(currentXp: number): {
	xp: number;
	xpLost: number;
} {
	const xpLost = Math.floor(currentXp * 0.05);
	return { xp: Math.max(0, currentXp - xpLost), xpLost };
}
