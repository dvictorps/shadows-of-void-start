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

/**
 * Reduce XP from a kill when the character is over-leveled vs the target.
 * PoE-style quadratic falloff — the first two levels above are free, then
 * each extra level over multiplies XP by `(1 - 0.1 × extra)²`. Floor at 5%
 * so kills always grant something, ceiling at 1.0.
 *
 *   delta = max(0, charLevel - targetLevel - OVERLEVEL_GRACE)
 *   mult  = clamp((1 - 0.1 × delta)², 0.05, 1)
 *
 * | char - target | mult |
 * |---|---|
 * |  ≤2  | 100% |
 * |  +3  |  81% |
 * |  +5  |  49% |
 * |  +7  |  25% |
 * | +12+ |   5% (floor) |
 */
export const OVERLEVEL_GRACE = 2;
export const OVERLEVEL_MIN_MULT = 0.05;

export function applyOverlevelPenalty(
	xp: number,
	charLevel: number,
	targetLevel: number,
): number {
	const delta = Math.max(0, charLevel - targetLevel - OVERLEVEL_GRACE);
	if (delta === 0) return xp;
	// Clamp the inner term to [0, 1] before squaring — without it, delta > 10
	// flips the sign and the square explodes into a XP *boost*.
	const inner = Math.max(0, 1 - 0.1 * delta);
	const mult = Math.max(OVERLEVEL_MIN_MULT, inner * inner);
	return Math.max(1, Math.round(xp * mult));
}
