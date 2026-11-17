import { randInt, type Rng } from "#/lib/rng";

export interface PathCell {
	x: number;
	y: number;
}

export interface PathLayout {
	cols: number;
	rows: number;
	cells: readonly PathCell[];
}

export const PATH_ROWS = 7;
const MS_PER_TILE = 1000;
const MIN_TILES = 8;
const TILES_PER_COLUMN = 3;

function rollRun(
	y: number,
	vertical: number,
	columnsLeft: number,
	rng: Rng,
): number {
	const reach = Math.max(y, PATH_ROWS - 1 - y);
	const lo = Math.max(0, vertical - columnsLeft * (PATH_ROWS - 1));
	const hi = Math.min(vertical, reach);
	if (hi <= lo) return hi;
	const fair = Math.ceil((2 * vertical) / (columnsLeft + 1));
	return randInt(lo, Math.max(lo, Math.min(hi, fair)), rng);
}

function rollDirection(y: number, run: number, rng: Rng): 1 | -1 {
	const canUp = y - run >= 0;
	const canDown = y + run <= PATH_ROWS - 1;
	if (canUp && canDown) return rng.unit() < 0.5 ? -1 : 1;
	return canUp ? -1 : 1;
}

export function rollPathLayout(budgetMs: number, rng: Rng): PathLayout {
	const target = Math.max(MIN_TILES, Math.round(budgetMs / MS_PER_TILE));
	const cols = Math.ceil(target / TILES_PER_COLUMN);
	let vertical = target - cols;
	let y = randInt(0, PATH_ROWS - 1, rng);
	const cells: PathCell[] = [];
	for (let x = 0; x < cols; x++) {
		cells.push({ x, y });
		const run = rollRun(y, vertical, cols - 1 - x, rng);
		const direction = rollDirection(y, run, rng);
		for (let step = 0; step < run; step++) {
			y += direction;
			cells.push({ x, y });
		}
		vertical -= run;
	}
	return { cols, rows: PATH_ROWS, cells };
}

const clamp01 = (fraction: number) => Math.min(1, Math.max(0, fraction));

export function cellIndexAt(layout: PathLayout, fraction: number): number {
	const last = layout.cells.length - 1;
	return Math.round(clamp01(fraction) * last);
}

export function stopCellIndex(layout: PathLayout, fraction: number): number {
	return Math.min(cellIndexAt(layout, fraction), layout.cells.length - 2);
}

export function pointAt(layout: PathLayout, fraction: number): PathCell {
	const last = layout.cells.length - 1;
	const position = clamp01(fraction) * last;
	const index = Math.floor(position);
	const from = layout.cells[index];
	const to = layout.cells[Math.min(index + 1, last)];
	const t = position - index;
	return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}
