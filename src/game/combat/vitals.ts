export function clampVital(value: number, max: number): number {
	return Math.max(0, Math.min(max, Math.floor(value)));
}

export interface VitalPatch {
	hpCurrent?: number;
	barrierCurrent?: number;
}

export interface VitalSyncResult {
	hpCurrent: number;
	patch: VitalPatch;
}

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

	const patch: VitalPatch = {};
	if (hpCurrent !== params.prevHp) patch.hpCurrent = hpCurrent;
	if (clampedBarrier !== undefined && clampedBarrier !== params.prevBarrier)
		patch.barrierCurrent = clampedBarrier;

	return { hpCurrent, patch };
}
