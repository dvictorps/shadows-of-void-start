import { defaultRng, type Rng } from "#/lib/rng";

export const CAMP_FIRE_FRAMES = [
	"/assets/sprites/acampamento/fogueira-1.png",
	"/assets/sprites/acampamento/fogueira-2.png",
	"/assets/sprites/acampamento/fogueira-3.png",
] as const;

export const CAMP_FIRE_FRAME_MS = 140;

export const CAMP_FIRE_ASPECT = { width: 820, height: 465 } as const;

export const CAMP_FIRE_CENTER = { xPct: 42.7, yPct: 57 } as const;

const MIN_GLOW = 0.8;

export function nextFireFrame(
	current: number,
	count: number,
	rng: Rng = defaultRng,
): number {
	if (count < 2) return current;
	const step = 1 + Math.floor(rng.unit() * (count - 1));
	return (current + step) % count;
}

export function nextGlow(rng: Rng = defaultRng): number {
	return MIN_GLOW + rng.unit() * (1 - MIN_GLOW);
}
