// The one place the game reads an ambient random source. `src/game` may not
// call `Math.random` / `crypto.randomUUID` itself (lint rule
// `shadows/game-determinism`), so every roll goes through here: one seam a
// test, or a future seeded RNG, can replace.

/** Uniform float in [0, 1). The default `random` source for engine functions that take one. */
export function randomUnit(): number {
	return Math.random();
}

/** True with probability `probability` (0–1). */
export function chance(probability: number): boolean {
	return randomUnit() < probability;
}

/** A fresh random id (UUID v4), for entities the engine creates (rolled items). */
export function randomId(): string {
	return crypto.randomUUID();
}

/**
 * Inclusive integer in [min, max]. Used by item rolls, damage rolls, and
 * monster pool picks — kept central so the math doesn't drift.
 */
export function randInt(min: number, max: number): number {
	return Math.floor(randomUnit() * (max - min + 1)) + min;
}

/**
 * Uniform float in [-magnitude, +magnitude]. Used for jitter — pitch variance
 * on SFX, camp-threshold scatter, etc.
 */
export function randSymmetric(magnitude: number): number {
	return (randomUnit() * 2 - 1) * magnitude;
}

/**
 * Uniform pick from a non-empty array. Returns undefined for empty input —
 * callers should guard length first when that's a possible state.
 */
export function pickRandom<T>(arr: readonly T[]): T | undefined {
	if (arr.length === 0) return undefined;
	return arr[Math.floor(randomUnit() * arr.length)];
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
	let roll = randomUnit() * totalWeight;
	for (const item of items) {
		roll -= getWeight(item);
		if (roll <= 0) return item;
	}
	return items.at(-1);
}

/**
 * Deterministic string → [0, 1) hash. For values that must stay stable across
 * re-renders and sessions without storing them (rare item names keyed by
 * item id, damage-popup offsets keyed by event id).
 *
 * FNV-1a over code points, then a murmur3 finalizer so short or near-identical
 * inputs (sequential ids) still spread across the whole range. `salt` derives
 * independent streams from the same input: hash(id, 0) and hash(id, 1) are
 * uncorrelated, so one id can drive several picks.
 */
export function hashStringToUnit(input: string, salt = 0): number {
	let h = Math.imul(2166136261 ^ salt, 16777619);
	for (let i = 0; i < input.length; i++) {
		h = Math.imul(h ^ (input.codePointAt(i) ?? 0), 16777619);
	}
	h ^= h >>> 16;
	h = Math.imul(h, 0x85ebca6b);
	h ^= h >>> 13;
	h = Math.imul(h, 0xc2b2ae35);
	h ^= h >>> 16;
	return (h >>> 0) / 2 ** 32;
}
