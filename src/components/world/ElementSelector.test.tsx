// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { elementName } from "#/game/combat/element-name";
import type { SelectableElement } from "#/game/stats/types";

import ElementSelector from "./ElementSelector";

afterEach(cleanup);

const element = (el: SelectableElement) =>
	screen.getByRole("button", { name: elementName(el) });

describe("ElementSelector", () => {
	it("marks only the selected element with aria-pressed", () => {
		render(
			<ElementSelector
				selected="cold"
				onSwitch={vi.fn<(element: SelectableElement) => void>()}
			/>,
		);
		expect(element("cold").getAttribute("aria-pressed")).toBe("true");
		expect(element("fire").getAttribute("aria-pressed")).toBe("false");
		expect(element("lightning").getAttribute("aria-pressed")).toBe("false");
	});

	it("switches to another element, not to the active one", () => {
		const onSwitch = vi.fn<(element: SelectableElement) => void>();
		render(<ElementSelector selected="fire" onSwitch={onSwitch} />);
		fireEvent.click(element("fire"));
		expect(onSwitch).not.toHaveBeenCalled();
		fireEvent.click(element("lightning"));
		expect(onSwitch).toHaveBeenCalledWith("lightning");
	});
});
