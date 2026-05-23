/**
 * Inclusive integer in [min, max]. Used by item rolls, damage rolls, and
 * monster pool picks — kept central so the math doesn't drift.
 */
export function randInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Uniform float in [-magnitude, +magnitude]. Used for jitter — pitch variance
 * on SFX, camp-threshold scatter, etc.
 */
export function randSymmetric(magnitude: number): number {
	return (Math.random() * 2 - 1) * magnitude;
}

/**
 * Uniform pick from a non-empty array. Returns undefined for empty input —
 * callers should guard length first when that's a possible state.
 */
export function pickRandom<T>(arr: readonly T[]): T | undefined {
	if (arr.length === 0) return undefined;
	return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Weighted pick from a non-empty array. Items with weight 0 never roll;
 * higher weights are more likely.
 */
export function pickWeighted<T>(
	items: readonly T[],
	getWeight: (item: T) => number,
): T | undefined {
	if (items.length === 0) return undefined;
	const totalWeight = items.reduce((sum, item) => sum + getWeight(item), 0);
	if (totalWeight <= 0) return undefined;
	let roll = Math.random() * totalWeight;
	for (const item of items) {
		roll -= getWeight(item);
		if (roll <= 0) return item;
	}
	return items[items.length - 1];
}
