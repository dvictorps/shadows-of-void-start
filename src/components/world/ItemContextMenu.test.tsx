// @vitest-environment jsdom

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { narrow } from "#/components/dom-test-utils";
import {
	inStagePortal,
	resetViewport,
	resizeViewport,
} from "#/components/game-stage/stage-test-utils";
import GameStage from "#/components/GameStage";

import ItemContextMenu, { type MenuAction } from "./ItemContextMenu";

type Props = Parameters<typeof ItemContextMenu>[0];

const ANCHOR = { left: 100, top: 100, right: 150, bottom: 150 };
const ROW_HEIGHT = 36;
const MENU_PADDING = 12;

function action(id: string, extra: Partial<MenuAction> = {}) {
	return {
		id,
		label: `Do ${id}`,
		onClick: vi.fn<() => void>(),
		...extra,
	};
}

function setup(overrides: Partial<Props> = {}) {
	const actions = overrides.actions ?? [action("equip"), action("discard")];
	const onClose = vi.fn<() => void>();
	const result = render(
		<div>
			<p>outside</p>
			<ItemContextMenu
				anchor={ANCHOR}
				onClose={onClose}
				{...overrides}
				actions={actions}
			/>
		</div>,
	);
	return { ...result, actions, onClose };
}

const menu = () => screen.getByRole("menu");
const labels = () =>
	within(menu())
		.getAllByRole("button")
		.map((b) => b.textContent);
const item = (label: string) =>
	narrow(within(menu()).getByRole("button", { name: label }), HTMLElement);
const menuStyle = () => narrow(menu(), HTMLElement).style;

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("ItemContextMenu — actions", () => {
	it("lists the actions in order, portaled to the body", () => {
		const t = setup({
			actions: [action("main"), action("off"), action("discard")],
		});
		expect(labels()).toEqual(["Do main", "Do off", "Do discard"]);
		expect(menu().parentElement).toBe(document.body);
		expect(t.container.contains(menu())).toBe(false);
	});

	it("runs the clicked action, then closes", () => {
		const order: string[] = [];
		const equip = action("equip", {
			onClick: vi.fn<() => void>(() => {
				order.push("run");
			}),
		});
		const discard = action("discard");
		const t = setup({ actions: [equip, discard] });
		t.onClose.mockImplementation(() => order.push("close"));
		fireEvent.click(item("Do equip"));
		expect(equip.onClick).toHaveBeenCalledTimes(1);
		expect(discard.onClick).not.toHaveBeenCalled();
		expect(order).toEqual(["run", "close"]);
	});

	it("leaves a disabled action inert", () => {
		const locked = action("locked", { disabled: true });
		const t = setup({ actions: [locked] });
		const button = narrow(item("Do locked"), HTMLButtonElement);
		expect(button.disabled).toBe(true);
		fireEvent.click(button);
		expect(locked.onClick).not.toHaveBeenCalled();
		expect(t.onClose).not.toHaveBeenCalled();
	});

	it("draws a divider only before an action that asks for one", () => {
		setup({
			actions: [action("main"), action("discard", { dividerBefore: true })],
		});
		const children = [...menu().children];
		expect(children).toHaveLength(3);
		expect(children[1].getAttribute("aria-hidden")).toBe("true");
		expect(children[2].textContent).toBe("Do discard");
		cleanup();
		setup({ actions: [action("main"), action("discard")] });
		expect(menu().children).toHaveLength(2);
	});
});

describe("ItemContextMenu — dismissal", () => {
	it("closes on a pointer down outside the menu", () => {
		const t = setup();
		fireEvent.pointerDown(screen.getByText("outside"));
		expect(t.onClose).toHaveBeenCalledTimes(1);
	});

	it("stays open on a pointer down inside the menu", () => {
		const t = setup();
		fireEvent.pointerDown(item("Do equip"));
		expect(t.onClose).not.toHaveBeenCalled();
	});

	it("closes on Escape", () => {
		const t = setup();
		fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
		expect(t.onClose).toHaveBeenCalledTimes(1);
	});

	it("stops listening once unmounted", () => {
		const t = setup();
		t.unmount();
		fireEvent.pointerDown(document.body);
		fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
		expect(t.onClose).not.toHaveBeenCalled();
	});
});

describe("ItemContextMenu — layout", () => {
	it("reports its rect on mount and null on unmount", () => {
		const rect = new DOMRect(10, 20, 220, 84);
		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
			rect,
		);
		const onLayout = vi.fn<(rect: DOMRect | null) => void>();
		const t = setup({ onLayout });
		expect(onLayout).toHaveBeenCalledTimes(1);
		expect(onLayout).toHaveBeenLastCalledWith(rect);
		act(() => t.unmount());
		expect(onLayout).toHaveBeenLastCalledWith(null);
	});

	it("opens below the anchor when it fits", () => {
		setup();
		expect(menuStyle().top).toBe(`${ANCHOR.bottom + 6}px`);
		expect(menuStyle().left).toBe(`${ANCHOR.left}px`);
	});

	it("flips above the anchor near the bottom of the viewport", () => {
		const bottom = window.innerHeight - 10;
		const anchor = { left: 100, top: bottom - 50, right: 150, bottom };
		setup({
			anchor,
			actions: [action("a"), action("b", { dividerBefore: true })],
		});
		const height = MENU_PADDING + 2 * ROW_HEIGHT + 9;
		expect(menuStyle().top).toBe(`${anchor.top - 6 - height}px`);
	});

	it("keeps clear of the viewport edges", () => {
		setup({ anchor: { left: -40, top: 5, right: 0, bottom: 10 } });
		expect(menuStyle().left).toBe("8px");
		cleanup();
		setup({
			anchor: { left: window.innerWidth, top: 5, right: 0, bottom: 10 },
		});
		expect(menuStyle().left).toBe(`${window.innerWidth - 220 - 8}px`);
	});
});

describe("ItemContextMenu — inside the scaled game stage", () => {
	afterEach(resetViewport);

	function setupInStage(anchor: Props["anchor"]) {
		resizeViewport(960, 540);
		render(
			<GameStage>
				<ItemContextMenu
					anchor={anchor}
					actions={[action("equip")]}
					onClose={vi.fn<() => void>()}
				/>
			</GameStage>,
		);
	}

	it("renders in the stage and opens at the click in stage pixels", () => {
		setupInStage(ANCHOR);
		expect(inStagePortal(menu())).toBe(true);
		expect(menuStyle().top).toBe(`${ANCHOR.bottom * 2 + 6}px`);
		expect(menuStyle().left).toBe(`${ANCHOR.left * 2}px`);
	});

	it("reads a DOMRect anchor, whose sides are prototype getters", () => {
		setupInStage(new DOMRect(100, 100, 50, 50));
		expect(menuStyle().top).toBe(`${150 * 2 + 6}px`);
		expect(menuStyle().left).toBe("200px");
	});

	it("clamps to the stage's 1920 px, not the viewport", () => {
		setupInStage({ left: 950, top: 5, right: 960, bottom: 10 });
		expect(menuStyle().left).toBe(`${1920 - 220 - 8}px`);
	});
});
