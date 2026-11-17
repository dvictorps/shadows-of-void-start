// The one place the game reads an ambient random source. `src/game` may not
// call `Math.random` / `crypto.randomUUID` itself (lint rule
// `shadows/game-determinism`), so every roll goes through here.
//
// The helpers draw from an `Rng`, `defaultRng` unless one is passed. Item
// generation, drops and combat rolls take an `rng` parameter (`generateItem`,
// `rollDrop`, `rollPlayerSwing`, `rollMonsterMods`, …), so a test can hand
// them `seededRng(seed)` and get the same rolls back.

/** A random source: uniform floats in [0, 1) and fresh ids. */
export interface Rng {
	unit: () => number;
	/** A fresh id (UUID v4 shape), for entities the engine creates. */
	id: () => string;
}

/** The ambient source: `Math.random` and `crypto.randomUUID`, read at call time. */
export const defaultRng: Rng = {
	unit: () => Math.random(),
	id: () => crypto.randomUUID(),
};

/**
 * A reproducible source for tests: the same seed yields the same floats and
 * ids. mulberry32 — fast, 32-bit state, plenty for game rolls; not for
 * anything security-related.
 */
export function seededRng(seed: number): Rng {
	let state = seed >>> 0;
	const unit = () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
	};
	const hex = (digits: number) =>
		Array.from({ length: digits }, () =>
			Math.floor(unit() * 16).toString(16),
		).join("");
	const id = () =>
		`${hex(8)}-${hex(4)}-4${hex(3)}-${"89ab"[Math.floor(unit() * 4)]}${hex(3)}-${hex(12)}`;
	return { unit, id };
}

/**
 * An `Rng` over a bare unit source: a test's scripted sequence of rolls
 * (`() => 0.5`, or one value per call). Ids come from a fixed seed.
 */
export function rngFromUnit(unit: () => number): Rng {
	return { ...seededRng(0), unit };
}

/** Uniform float in [0, 1) from the ambient source. */
export function randomUnit(): number {
	return defaultRng.unit();
}

/** True with probability `probability` (0–1). */
export function chance(probability: number, rng: Rng = defaultRng): boolean {
	return rng.unit() < probability;
}

/**
 * Inclusive integer in [min, max]. Used by item rolls, damage rolls, and
 * monster pool picks — kept central so the math doesn't drift.
 */
export function randInt(
	min: number,
	max: number,
	rng: Rng = defaultRng,
): number {
	return Math.floor(rng.unit() * (max - min + 1)) + min;
}

/**
 * Uniform float in [-magnitude, +magnitude]. Used for jitter — pitch variance
 * on SFX, camp-threshold scatter, etc.
 */
export function randSymmetric(
	magnitude: number,
	rng: Rng = defaultRng,
): number {
	return (rng.unit() * 2 - 1) * magnitude;
}

/**
 * Uniform pick from a non-empty array. Returns undefined for empty input —
 * callers should guard length first when that's a possible state.
 */
export function pickRandom<T>(
	arr: readonly T[],
	rng: Rng = defaultRng,
): T | undefined {
	if (arr.length === 0) return undefined;
	return arr[Math.floor(rng.unit() * arr.length)];
}

/**
 * Weighted pick from a non-empty array. Items with weight 0 never roll;
 * higher weights are more likely.
 */
export function pickWeighted<T>(
	items: readonly T[],
	getWeight: (item: T) => number,
	rng: Rng = defaultRng,
): T | undefined {
	if (items.length === 0) return undefined;
	const totalWeight = items.reduce((sum, item) => sum + getWeight(item), 0);
	if (totalWeight <= 0) return undefined;
	let roll = rng.unit() * totalWeight;
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
