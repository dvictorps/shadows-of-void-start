import { describe, expect, it } from "vitest";

import {
	clientRectToStage,
	fitStage,
	IDENTITY_FIT,
	STAGE_MAX_HEIGHT,
	STAGE_MIN_HEIGHT,
	STAGE_WIDTH,
} from "./fit";

describe("fitStage", () => {
	it("is the identity at the 1920×1080 reference", () => {
		expect(fitStage(1920, 1080)).toEqual({
			scale: 1,
			offsetX: 0,
			offsetY: 0,
			height: 1080,
		});
	});

	it("keeps the scale at 1 in a 1080p browser tab and lays out a shorter stage", () => {
		expect(fitStage(1920, 900)).toEqual({
			scale: 1,
			offsetX: 0,
			offsetY: 0,
			height: 900,
		});
	});

	it("scales with the width and fills a smaller 16:9 viewport with no bars", () => {
		const fit = fitStage(1366, 768);
		expect(fit.scale).toBe(1366 / STAGE_WIDTH);
		expect(fit.height).toBe(1079);
		expect(fit.offsetX).toBe(0);
		expect(fit.offsetY).toBe(0);
	});

	it("scales up on a bigger 16:9 viewport", () => {
		expect(fitStage(2560, 1440)).toEqual({
			scale: 4 / 3,
			offsetX: 0,
			offsetY: 0,
			height: 1080,
		});
	});

	it("fills a 21:9 ultrawide with a stage down near its minimum height", () => {
		const fit = fitStage(3440, 1440);
		expect(fit.height).toBe(803);
		expect(fit.offsetX).toBeLessThanOrEqual(1);
		expect(fit.offsetY).toBeLessThanOrEqual(1);
	});

	it("lays out a taller stage on a 16:10 viewport", () => {
		expect(fitStage(1920, 1200)).toEqual({
			scale: 1,
			offsetX: 0,
			offsetY: 0,
			height: STAGE_MAX_HEIGHT,
		});
	});

	it("stops at the minimum height and puts bars at the sides below it", () => {
		expect(fitStage(1920, 700)).toEqual({
			scale: 700 / STAGE_MIN_HEIGHT,
			offsetX: 120,
			offsetY: 0,
			height: STAGE_MIN_HEIGHT,
		});
	});

	it("stops at the maximum height and puts bars at the top and bottom above it", () => {
		const fit = fitStage(1000, 1400);
		expect(fit.height).toBe(STAGE_MAX_HEIGHT);
		expect(fit.scale).toBeCloseTo(1000 / STAGE_WIDTH, 6);
		expect(fit.offsetX).toBe(0);
		expect(fit.offsetY).toBe(388);
	});

	it("always fits the whole stage inside the viewport", () => {
		for (const [w, h] of [
			[1280, 1024],
			[1600, 900],
			[1920, 969],
			[800, 1400],
			[3840, 1080],
		]) {
			const fit = fitStage(w, h);
			expect(fit.height).toBeGreaterThanOrEqual(STAGE_MIN_HEIGHT);
			expect(fit.height).toBeLessThanOrEqual(STAGE_MAX_HEIGHT);
			expect(STAGE_WIDTH * fit.scale + 2 * fit.offsetX).toBeLessThanOrEqual(
				w + 1,
			);
			expect(fit.height * fit.scale + 2 * fit.offsetY).toBeLessThanOrEqual(
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
		const fit = { scale: 0.5, offsetX: 100, offsetY: 40, height: 1080 };
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
