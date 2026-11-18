// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { narrow } from "#/components/dom-test-utils";
import {
	inStagePortal,
	resetViewport,
	resizeViewport,
} from "#/components/game-stage/stage-test-utils";
import GameStage from "#/components/GameStage";
import { sword } from "#/components/world/item-test-fixtures";

import ItemCard from "./ItemCard";

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	resetViewport();
});

function hoverCardAt(left: number, top: number, size: number) {
	vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
		new DOMRect(left, top, size, size),
	);
	fireEvent.mouseEnter(screen.getByRole("button", { name: "Test Sword" }));
}

function tooltipBox(): HTMLElement {
	const tooltip = document.querySelector('[style*="z-index: 1000"]');
	return narrow(tooltip, HTMLElement);
}

describe("ItemCard — hover tooltip", () => {
	it("portals to the body beside the card outside the game stage", () => {
		render(<ItemCard item={sword()} />);
		hoverCardAt(100, 50, 64);
		expect(tooltipBox().parentElement).toBe(document.body);
		expect(tooltipBox().style.left).toBe(`${100 + 64 + 12}px`);
		expect(tooltipBox().style.top).toBe("50px");
	});

	it("renders in the scaled stage, placed in stage pixels", () => {
		resizeViewport(960, 540);
		render(
			<GameStage>
				<ItemCard item={sword()} />
			</GameStage>,
		);
		hoverCardAt(100, 50, 32);
		expect(inStagePortal(tooltipBox())).toBe(true);
		expect(tooltipBox().style.left).toBe(`${(100 + 32) * 2 + 12}px`);
		expect(tooltipBox().style.top).toBe("100px");
	});

	it("flips left against the stage's right edge", () => {
		resizeViewport(960, 540);
		render(
			<GameStage>
				<ItemCard item={sword()} />
			</GameStage>,
		);
		hoverCardAt(900, 50, 32);
		expect(tooltipBox().style.left).toBe(`${900 * 2 - 12 - 280}px`);
	});
});
