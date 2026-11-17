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

const AREA_PER_TILE = 3.2;
const GRID_ASPECT = 2.4;
const ATTEMPTS = 6;
const GROWTH_PER_ATTEMPT = 1.25;
const MAX_EXPANSIONS = 4000;
const KEEP_HEADING = 0.55;

const STEPS: readonly PathCell[] = [
	{ x: 1, y: 0 },
	{ x: 0, y: 1 },
	{ x: -1, y: 0 },
	{ x: 0, y: -1 },
];

const key = (c: PathCell) => `${c.x},${c.y}`;

interface Grid {
	w: number;
	h: number;
}

function gridFor(target: number, scale: number): Grid {
	const area = target * AREA_PER_TILE * scale;
	const w = Math.ceil(Math.sqrt(area * GRID_ASPECT));
	return { w, h: Math.max(3, Math.ceil(area / w)) };
}

function rollEdgeStart(grid: Grid, rng: Rng): PathCell {
	const side = randInt(0, 3, rng);
	const along = (size: number) => randInt(0, size - 1, rng);
	if (side === 0) return { x: 0, y: along(grid.h) };
	if (side === 1) return { x: grid.w - 1, y: along(grid.h) };
	if (side === 2) return { x: along(grid.w), y: 0 };
	return { x: along(grid.w), y: grid.h - 1 };
}

function touchesOnlyItsTail(
	next: PathCell,
	tail: ReadonlySet<string>,
	onPath: ReadonlySet<string>,
): boolean {
	for (let dx = -1; dx <= 1; dx++) {
		for (let dy = -1; dy <= 1; dy++) {
			const near = key({ x: next.x + dx, y: next.y + dy });
			if (onPath.has(near) && !tail.has(near)) return false;
		}
	}
	return true;
}

function candidates(
	path: readonly PathCell[],
	onPath: ReadonlySet<string>,
	grid: Grid,
	rng: Rng,
): PathCell[] {
	const head = path.at(-1);
	const prev = path.at(-2);
	if (!head) return [];
	const tail = new Set(path.slice(-2).map(key));
	const open = STEPS.map((s) => ({ x: head.x + s.x, y: head.y + s.y })).filter(
		(c) =>
			c.x >= 0 &&
			c.y >= 0 &&
			c.x < grid.w &&
			c.y < grid.h &&
			!onPath.has(key(c)) &&
			touchesOnlyItsTail(c, tail, onPath),
	);
	const shuffled = open
		.map((c) => ({ c, r: rng.unit() }))
		.toSorted((a, b) => a.r - b.r)
		.map((e) => e.c);
	if (!prev || rng.unit() >= KEEP_HEADING) return shuffled;
	const ahead = key({ x: 2 * head.x - prev.x, y: 2 * head.y - prev.y });
	return [
		...shuffled.filter((c) => key(c) === ahead),
		...shuffled.filter((c) => key(c) !== ahead),
	];
}

function walk(target: number, grid: Grid, rng: Rng): PathCell[] | null {
	const path: PathCell[] = [rollEdgeStart(grid, rng)];
	const onPath = new Set([key(path[0])]);
	const options: PathCell[][] = [candidates(path, onPath, grid, rng)];
	let expansions = 0;
	while (path.length < target) {
		expansions += 1;
		if (expansions > MAX_EXPANSIONS) return null;
		const next = options.at(-1)?.shift();
		if (!next) {
			options.pop();
			const dropped = path.pop();
			if (!dropped || path.length === 0) return null;
			onPath.delete(key(dropped));
			continue;
		}
		path.push(next);
		onPath.add(key(next));
		options.push(candidates(path, onPath, grid, rng));
	}
	return path;
}

function fitToBox(cells: readonly PathCell[]): PathLayout {
	const minX = Math.min(...cells.map((c) => c.x));
	const minY = Math.min(...cells.map((c) => c.y));
	const shifted = cells.map((c) => ({ x: c.x - minX, y: c.y - minY }));
	return {
		cols: Math.max(...shifted.map((c) => c.x)) + 1,
		rows: Math.max(...shifted.map((c) => c.y)) + 1,
		cells: shifted,
	};
}

function straightLine(target: number): PathLayout {
	return fitToBox(Array.from({ length: target }, (_, x) => ({ x, y: 0 })));
}

export function rollPathLayout(target: number, rng: Rng): PathLayout {
	for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
		const grid = gridFor(target, GROWTH_PER_ATTEMPT ** attempt);
		const cells = walk(target, grid, rng);
		if (cells) return fitToBox(cells);
	}
	return straightLine(target);
}

const clamp01 = (fraction: number) => Math.min(1, Math.max(0, fraction));

export function cellIndexAt(layout: PathLayout, fraction: number): number {
	const last = layout.cells.length - 1;
	return Math.round(clamp01(fraction) * last);
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
