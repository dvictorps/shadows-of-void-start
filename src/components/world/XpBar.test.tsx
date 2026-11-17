// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { narrow } from "#/components/dom-test-utils";
import { m } from "#/paraglide/messages";

import { XpBar, type XpBarSize } from "./XpBar";

afterEach(cleanup);

const bar = () => screen.getByRole("progressbar", { name: m.xp_bar_aria() });
const fill = () => narrow(bar().firstElementChild, HTMLElement);
const label = (xp: number, xpNeeded: number) =>
	screen.getByText(m.status_xp_label({ current: xp, needed: xpNeeded }));

describe("XpBar", () => {
	it("labels the bar and reports its values", () => {
		render(<XpBar xp={30} xpNeeded={120} size="md" />);
		expect(label(30, 120)).toBeTruthy();
		expect(bar().getAttribute("aria-valuenow")).toBe("30");
		expect(bar().getAttribute("aria-valuemin")).toBe("0");
		expect(bar().getAttribute("aria-valuemax")).toBe("120");
		expect(fill().style.width).toBe("25%");
	});

	it("clamps the fill at full", () => {
		render(<XpBar xp={500} xpNeeded={100} size="hud" />);
		expect(fill().style.width).toBe("100%");
	});

	it("draws empty when nothing is needed", () => {
		render(<XpBar xp={10} xpNeeded={0} size="hud" />);
		expect(fill().style.width).toBe("0%");
	});

	it.each<[XpBarSize, string, string]>([
		["hud", "text-[10px]", "h-3"],
		["md", "text-sm", "h-2"],
		["sm", "text-xs", "h-2"],
	])("size %s: label %s, track %s", (size, labelClass, trackClass) => {
		render(<XpBar xp={1} xpNeeded={2} size={size} />);
		expect(label(1, 2).className).toContain(labelClass);
		expect(bar().className).toContain(trackClass);
	});
});
