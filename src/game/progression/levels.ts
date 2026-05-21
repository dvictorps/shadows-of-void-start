// Growth (1.08) is intentionally steeper than the monster XP scaling rate
// (1.06) so kills-per-level rises with character level. Anchored at 100 XP
// for L1→L2 to preserve the early-game pace. See CONTEXT.md → "Experience
// and Levels".
export const XP_CURVE_BASE = 100;
export const XP_CURVE_GROWTH = 1.08;

export function xpToNextLevel(level: number): number {
	const clamped = Math.max(1, level);
	return Math.max(
		1,
		Math.floor(XP_CURVE_BASE * XP_CURVE_GROWTH ** (clamped - 1)),
	);
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
