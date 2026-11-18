import { describe, expect, it } from "vitest";

import {
	clientRectToStage,
	fitStage,
	IDENTITY_FIT,
	STAGE_HEIGHT,
	STAGE_WIDTH,
} from "./fit";

describe("fitStage", () => {
	it("is the identity at the 1920×1080 reference", () => {
		expect(fitStage(1920, 1080)).toEqual({ scale: 1, offsetX: 0, offsetY: 0 });
	});

	it("scales down to fill a smaller 16:9 viewport with no bars", () => {
		const fit = fitStage(1366, 768);
		expect(fit.scale).toBeCloseTo(0.7111, 4);
		expect(fit.offsetX).toBe(0);
		expect(fit.offsetY).toBe(0);
	});

	it("scales up on a bigger 16:9 viewport", () => {
		expect(fitStage(2560, 1440)).toEqual({
			scale: 4 / 3,
			offsetX: 0,
			offsetY: 0,
		});
	});

	it("puts bars at the sides of an ultrawide viewport", () => {
		const fit = fitStage(3440, 1440);
		expect(fit.scale).toBe(4 / 3);
		expect(fit.offsetX).toBe(440);
		expect(fit.offsetY).toBe(0);
	});

	it("puts bars at the top and bottom of a 16:10 viewport", () => {
		expect(fitStage(1920, 1200)).toEqual({
			scale: 1,
			offsetX: 0,
			offsetY: 60,
		});
	});

	it("always fits the whole stage inside the viewport", () => {
		for (const [w, h] of [
			[1280, 1024],
			[1600, 900],
			[1920, 969],
			[800, 1400],
		]) {
			const fit = fitStage(w, h);
			expect(STAGE_WIDTH * fit.scale + 2 * fit.offsetX).toBeLessThanOrEqual(
				w + 1,
			);
			expect(STAGE_HEIGHT * fit.scale + 2 * fit.offsetY).toBeLessThanOrEqual(
				h + 1,
			);
		}
	});

	it("falls back to the identity on an empty viewport", () => {
		expect(fitStage(0, 768)).toBe(IDENTITY_FIT);
		expect(fitStage(1366, 0)).toBe(IDENTITY_FIT);
	});
});

describe("clientRectToStage", () => {
	it("leaves a rect alone at the identity", () => {
		const rect = {
			left: 10,
			top: 20,
			right: 74,
			bottom: 84,
			width: 64,
			height: 64,
		};
		expect(clientRectToStage(rect, IDENTITY_FIT)).toEqual(rect);
	});

	it("removes the bar offset and divides by the scale", () => {
		const fit = { scale: 0.5, offsetX: 100, offsetY: 40 };
		expect(
			clientRectToStage({ left: 132, top: 72, right: 164, bottom: 104 }, fit),
		).toEqual({
			left: 64,
			top: 64,
			right: 128,
			bottom: 128,
			width: 64,
			height: 64,
		});
	});
});
