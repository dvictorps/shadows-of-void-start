/**
 * How full a bar or globe is, as a CSS percent: `current / max × 100`,
 * clamped to 0–100, and 0 when there is no max (an empty pool draws empty
 * instead of dividing by zero).
 */
export function fillPercent(current: number, max: number): number {
	if (max <= 0) return 0;
	return Math.max(0, Math.min(100, (current / max) * 100));
}
