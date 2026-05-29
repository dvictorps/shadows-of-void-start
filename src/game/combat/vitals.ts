// Pure vital-clamping + HP/barrier write-back decisions, extracted from
// `convex/combat.ts` (`syncHp`, and reused by `usePotion`). The mutation stays
// the auth/IO boundary; "given the client-reported vitals and the
// authoritative caps, what should actually be stored" lives here so it can be
// unit-tested without a Convex runtime (the mutation opens with a better-auth
// read that `convex-test` can't satisfy — see docs/codebase-map.md → convex
// testing convention).

/**
 * Clamp a client-reported vital to `[0, max]` and floor it to an integer. The
 * client sim runs in floats and the DB stores integers, so every HP/barrier
 * write-back funnels through here — a tampered or over-cap value can never
 * persist past this clamp.
 */
export function clampVital(value: number, max: number): number {
	return Math.max(0, Math.min(max, Math.floor(value)));
}

export interface VitalSyncResult {
	/** The clamped HP, always returned so the caller can echo it to the client
	 * even when nothing changed. */
	hpCurrent: number;
	/** Only the fields that actually changed, so the caller can skip the DB
	 * write entirely when the patch is empty (the common idle-tick case). */
	patch: { hpCurrent?: number; barrierCurrent?: number };
}

/**
 * Resolve a periodic HP/barrier sync. Clamps both vitals against their caps,
 * then diffs against what's stored so the caller only patches the fields that
 * moved. A barrier omitted by the client (`undefined`) is never written.
 */
export function resolveVitalSync(params: {
	maxLife: number;
	maxBarrier: number;
	prevHp: number;
	prevBarrier: number;
	clientHp: number;
	clientBarrier: number | undefined;
}): VitalSyncResult {
	const hpCurrent = clampVital(params.clientHp, params.maxLife);
	const clampedBarrier =
		params.clientBarrier !== undefined
			? clampVital(params.clientBarrier, params.maxBarrier)
			: undefined;

	const patch: { hpCurrent?: number; barrierCurrent?: number } = {};
	if (hpCurrent !== params.prevHp) patch.hpCurrent = hpCurrent;
	if (clampedBarrier !== undefined && clampedBarrier !== params.prevBarrier)
		patch.barrierCurrent = clampedBarrier;

	return { hpCurrent, patch };
}
