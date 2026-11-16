// @vitest-environment jsdom

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { afterEach, describe, expect, it } from "vitest";

import { m } from "#/paraglide/messages";

import RubyCounter from "./RubyCounter";

afterEach(cleanup);

describe("RubyCounter", () => {
	it("names the balance and explains it on hover, both localized", async () => {
		render(
			<TooltipPrimitive.Provider delayDuration={0}>
				<RubyCounter rubys={42} />
			</TooltipPrimitive.Provider>,
		);
		const counter = screen.getByRole("img", {
			name: m.ruby_balance_label({ count: 42 }),
		});
		expect(counter.textContent).toContain("42");
		await act(async () => {
			fireEvent.focus(counter);
		});
		expect(screen.getAllByText(m.ruby_tooltip()).length).toBeGreaterThan(0);
	});
});
