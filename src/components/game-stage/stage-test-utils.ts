import { narrow } from "#/components/dom-test-utils";

const JSDOM_VIEWPORT = { width: 1024, height: 768 };

export function resizeViewport(width: number, height: number) {
	Object.defineProperty(window, "innerWidth", {
		configurable: true,
		value: width,
	});
	Object.defineProperty(window, "innerHeight", {
		configurable: true,
		value: height,
	});
	window.dispatchEvent(new Event("resize"));
}

export function resetViewport() {
	resizeViewport(JSDOM_VIEWPORT.width, JSDOM_VIEWPORT.height);
}

export function stageElement(): HTMLElement {
	return narrow(document.querySelector("[data-game-stage]"), HTMLElement);
}

export function inStagePortal(node: Element): boolean {
	return node.closest("[data-game-stage-portal]") !== null;
}
