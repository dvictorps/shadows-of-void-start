export const CANOPY_SIZE = 1.5;
export const CANOPY_PERIOD = 2;

export type CanopyTree = { x: number; y: number; flip: boolean };

function rowShift(row: number) {
	return row % 2 === 0 ? 0 : 0.5;
}

export function canopyTrees(): CanopyTree[] {
	const trees: CanopyTree[] = [];
	for (let row = 0; row <= CANOPY_PERIOD; row++) {
		for (let col = -1; col <= CANOPY_PERIOD; col++) {
			const centerX = col + 0.5 + rowShift(row);
			trees.push({
				x: centerX - CANOPY_SIZE / 2,
				y: row + 1 - CANOPY_SIZE,
				flip: (col + row) % 2 !== 0,
			});
		}
	}
	return trees;
}
