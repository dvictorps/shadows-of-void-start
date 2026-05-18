import {
	LEECH_CAP_PCT_MAX_LIFE_PER_SECOND,
	LEECH_RATE_PER_SECOND,
} from "./constants";

export interface LeechInstance {
	/** Total HP this instance will restore over its lifetime. */
	magnitude: number;
	/** HP/second this instance ticks at. */
	rate: number;
	/** HP still left to deliver. */
	remaining: number;
}

export function createLeechInstance(
	damageDealt: number,
	leechPercent: number,
): LeechInstance | null {
	if (damageDealt <= 0 || leechPercent <= 0) return null;
	const magnitude = (damageDealt * leechPercent) / 100;
	if (magnitude <= 0) return null;
	const rate = magnitude * LEECH_RATE_PER_SECOND;
	return { magnitude, rate, remaining: magnitude };
}

export interface LeechTickResult {
	healed: number;
	instances: LeechInstance[];
}

/**
 * Advances every active leech instance by `dt` seconds. Total heal across all
 * instances is capped at `LEECH_CAP_PCT_MAX_LIFE_PER_SECOND × maxLife` per
 * second — excess healing this tick is dropped, but each instance still
 * burns down its remaining magnitude (no carryover).
 */
export function tickLeechInstances(
	instances: LeechInstance[],
	dt: number,
	maxLife: number,
): LeechTickResult {
	if (instances.length === 0 || dt <= 0) return { healed: 0, instances };

	const capPerSecond = maxLife * LEECH_CAP_PCT_MAX_LIFE_PER_SECOND;
	const capThisTick = capPerSecond * dt;

	let rawHeal = 0;
	const next: LeechInstance[] = [];
	for (const inst of instances) {
		const wantThisTick = inst.rate * dt;
		const deliver = Math.min(wantThisTick, inst.remaining);
		rawHeal += deliver;
		const remaining = inst.remaining - deliver;
		if (remaining > 0.001) {
			next.push({ magnitude: inst.magnitude, rate: inst.rate, remaining });
		}
	}

	const healed = Math.min(rawHeal, capThisTick);
	return { healed, instances: next };
}
