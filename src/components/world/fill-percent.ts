export function fillPercent(current: number, max: number): number {
	if (max <= 0) return 0;
	return Math.max(0, Math.min(100, (current / max) * 100));
}
