export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;
export const STAGE_MIN_HEIGHT = 800;
export const STAGE_MAX_HEIGHT = 1200;

export type StageFit = {
	scale: number;
	offsetX: number;
	offsetY: number;
	height: number;
};

export type RectSides = {
	left: number;
	top: number;
	right: number;
	bottom: number;
};

export type StageRect = RectSides & { width: number; height: number };

export const IDENTITY_FIT: StageFit = {
	scale: 1,
	offsetX: 0,
	offsetY: 0,
	height: STAGE_HEIGHT,
};

export function fitStage(
	viewportWidth: number,
	viewportHeight: number,
): StageFit {
	if (viewportWidth <= 0 || viewportHeight <= 0) return IDENTITY_FIT;
	const wantedHeight = (viewportHeight * STAGE_WIDTH) / viewportWidth;
	const height = Math.floor(
		Math.min(STAGE_MAX_HEIGHT, Math.max(STAGE_MIN_HEIGHT, wantedHeight)),
	);
	const scale = Math.min(viewportWidth / STAGE_WIDTH, viewportHeight / height);
	return {
		scale,
		offsetX: Math.max(0, Math.round((viewportWidth - STAGE_WIDTH * scale) / 2)),
		offsetY: Math.max(0, Math.round((viewportHeight - height * scale) / 2)),
		height,
	};
}

export function clientRectToStage(rect: RectSides, fit: StageFit): StageRect {
	const left = (rect.left - fit.offsetX) / fit.scale;
	const top = (rect.top - fit.offsetY) / fit.scale;
	const width = (rect.right - rect.left) / fit.scale;
	const height = (rect.bottom - rect.top) / fit.scale;
	return {
		left,
		top,
		width,
		height,
		right: left + width,
		bottom: top + height,
	};
}
