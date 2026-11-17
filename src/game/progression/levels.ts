export const XP_CURVE_BASE = 100;
export const XP_CURVE_GROWTH = 1.08;

export function xpToNextLevel(level: number): number {
	const clamped = Math.max(1, level);
	return Math.max(
		1,
		Math.floor(XP_CURVE_BASE * XP_CURVE_GROWTH ** (clamped - 1)),
	);
}

export interface XpGainResult {
	level: number;
	xp: number;
	levelsGained: number;
}

export function applyXpGain(
	currentLevel: number,
	currentXp: number,
	amount: number,
	levelCap = 100,
): XpGainResult {
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

export interface DeathXpPenaltyResult {
	xp: number;
	xpLost: number;
}

export function applyDeathXpPenalty(currentXp: number): DeathXpPenaltyResult {
	const xpLost = Math.floor(currentXp * 0.05);
	return { xp: Math.max(0, currentXp - xpLost), xpLost };
}

export const OVERLEVEL_GRACE = 2;
export const OVERLEVEL_MIN_MULT = 0.05;

export function applyOverlevelPenalty(
	xp: number,
	charLevel: number,
	targetLevel: number,
): number {
	const delta = Math.max(0, charLevel - targetLevel - OVERLEVEL_GRACE);
	if (delta === 0) return xp;
	const inner = Math.max(0, 1 - 0.1 * delta);
	const mult = Math.max(OVERLEVEL_MIN_MULT, inner * inner);
	return Math.max(1, Math.round(xp * mult));
}
