// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { createPortal } from "react-dom";
import { afterEach, describe, expect, it } from "vitest";

import { portalTarget, useGameStage } from "./game-stage/context";
import {
	inStagePortal,
	resetViewport,
	resizeViewport as resizeTo,
	stageElement as stage,
} from "./game-stage/stage-test-utils";
import GameStage from "./GameStage";

function placement() {
	const { style } = stage();
	return ["--stage-x", "--stage-y", "--stage-scale"].map((name) =>
		style.getPropertyValue(name),
	);
}

function Probe() {
	const view = useGameStage();
	const rect = view.toStage({
		left: 100,
		top: 100,
		right: 150,
		bottom: 150,
	});
	return (
		<p>
			{`scale ${view.scale} bounds ${view.width}x${view.height} rect ${rect.left},${rect.top} ${rect.width}`}
		</p>
	);
}

function PortalProbe() {
	const view = useGameStage();
	if (!view.container) return null;
	return createPortal(<span>portaled</span>, portalTarget(view));
}

afterEach(() => {
	cleanup();
	resetViewport();
});

describe("GameStage", () => {
	it("lays the stage out at 1920×1080 and scales it to the viewport", () => {
		resizeTo(1366, 768);
		render(
			<GameStage>
				<Probe />
			</GameStage>,
		);
		expect(stage().className).toContain("game-stage");
		expect(stage().className).not.toContain("invisible");
		expect(placement()).toEqual(["0px", "0px", `${768 / 1080}`]);
	});

	it("letterboxes an ultrawide viewport and follows a resize", () => {
		resizeTo(3440, 1440);
		render(
			<GameStage>
				<Probe />
			</GameStage>,
		);
		expect(placement()).toEqual(["440px", "0px", `${4 / 3}`]);
		act(() => resizeTo(1920, 1200));
		expect(placement()).toEqual(["0px", "60px", "1"]);
	});

	it("gives children the scale, the stage bounds and client-to-stage mapping", () => {
		resizeTo(960, 540);
		render(
			<GameStage>
				<Probe />
			</GameStage>,
		);
		expect(screen.getByText(/^scale/).textContent).toBe(
			"scale 0.5 bounds 1920x1080 rect 200,200 100",
		);
	});

	it("renders portals into a container inside the scaled stage", () => {
		resizeTo(1920, 1080);
		render(
			<GameStage>
				<PortalProbe />
			</GameStage>,
		);
		const portaled = screen.getByText("portaled");
		expect(stage().contains(portaled)).toBe(true);
		expect(inStagePortal(portaled)).toBe(true);
	});

	it("falls back to the viewport outside a stage", () => {
		resizeTo(1024, 768);
		render(<Probe />);
		expect(screen.getByText(/^scale/).textContent).toBe(
			"scale 1 bounds 1024x768 rect 100,100 50",
		);
	});
});
