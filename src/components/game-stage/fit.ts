export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;

export type StageFit = { scale: number; offsetX: number; offsetY: number };

export type RectSides = {
	left: number;
	top: number;
	right: number;
	bottom: number;
};

export type StageRect = RectSides & { width: number; height: number };

export const IDENTITY_FIT: StageFit = { scale: 1, offsetX: 0, offsetY: 0 };

export function fitStage(
	viewportWidth: number,
	viewportHeight: number,
): StageFit {
	if (viewportWidth <= 0 || viewportHeight <= 0) return IDENTITY_FIT;
	const scale = Math.min(
		viewportWidth / STAGE_WIDTH,
		viewportHeight / STAGE_HEIGHT,
	);
	return {
		scale,
		offsetX: Math.round((viewportWidth - STAGE_WIDTH * scale) / 2),
		offsetY: Math.round((viewportHeight - STAGE_HEIGHT * scale) / 2),
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
