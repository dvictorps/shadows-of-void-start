import { createContext, useContext, useMemo } from "react";

import {
	clientRectToStage,
	IDENTITY_FIT,
	type RectSides,
	STAGE_WIDTH,
	type StageFit,
	type StageRect,
} from "./fit";

export type GameStageValue = {
	fit: StageFit;
	container: HTMLElement | null;
};

export const GameStageContext = createContext<GameStageValue | null>(null);

export type StageView = {
	readonly scale: number;
	readonly container: HTMLElement | undefined;
	readonly width: number;
	readonly height: number;
	toStage: (rect: RectSides) => StageRect;
};

const FALLBACK_VIEWPORT = { width: 1200, height: 800 };
const hasWindow = () => globalThis.window !== undefined;

const VIEWPORT_VIEW: StageView = {
	scale: 1,
	container: undefined,
	get width() {
		return hasWindow() ? window.innerWidth : FALLBACK_VIEWPORT.width;
	},
	get height() {
		return hasWindow() ? window.innerHeight : FALLBACK_VIEWPORT.height;
	},
	toStage: (rect) => clientRectToStage(rect, IDENTITY_FIT),
};

export function useGameStage(): StageView {
	const stage = useContext(GameStageContext);
	return useMemo(() => {
		if (!stage) return VIEWPORT_VIEW;
		return {
			scale: stage.fit.scale,
			container: stage.container ?? undefined,
			width: STAGE_WIDTH,
			height: stage.fit.height,
			toStage: (rect) => clientRectToStage(rect, stage.fit),
		};
	}, [stage]);
}

export function portalTarget(stage: StageView): HTMLElement {
	return stage.container ?? document.body;
}
