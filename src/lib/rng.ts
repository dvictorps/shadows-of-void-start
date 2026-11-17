export interface Rng {
	unit: () => number;
	id: () => string;
}

export const defaultRng: Rng = {
	unit: () => Math.random(),
	id: () => crypto.randomUUID(),
};

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

export function rngFromUnit(unit: () => number): Rng {
	return { ...seededRng(0), unit };
}

export function randomUnit(): number {
	return defaultRng.unit();
}

export function chance(probability: number, rng: Rng = defaultRng): boolean {
	return rng.unit() < probability;
}

export function randInt(
	min: number,
	max: number,
	rng: Rng = defaultRng,
): number {
	return Math.floor(rng.unit() * (max - min + 1)) + min;
}

export function randSymmetric(
	magnitude: number,
	rng: Rng = defaultRng,
): number {
	return (rng.unit() * 2 - 1) * magnitude;
}

export function pickRandom<T>(
	arr: readonly T[],
	rng: Rng = defaultRng,
): T | undefined {
	if (arr.length === 0) return undefined;
	return arr[Math.floor(rng.unit() * arr.length)];
}

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
