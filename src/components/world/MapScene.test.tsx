// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { narrow } from "#/components/dom-test-utils";
import { ACT_1, type Act, type WorldNode } from "#/game/world";
import { translateNodeName } from "#/game/world/i18n";
import { m } from "#/paraglide/messages";

import MapScene from "./MapScene";

type Props = Parameters<typeof MapScene>[0];

afterEach(cleanup);

function setup(overrides: Partial<Props> = {}) {
	const onEnterNode = vi.fn<Props["onEnterNode"]>();
	const onHoverNode = vi.fn<Props["onHoverNode"]>();
	const onOpenSettings = vi.fn<() => void>();
	let props: Props = {
		act: ACT_1,
		onEnterNode,
		onHoverNode,
		hoveredNodeId: null,
		currentLocationNodeId: "city",
		unlockedNodeIds: new Set(["city"]),
		completedZoneIds: new Set(),
		hasTeleportStone: false,
		onOpenSettings,
		...overrides,
	};
	const result = render(<MapScene {...props} />);
	const update = (next: Partial<Props>) => {
		props = { ...props, ...next };
		result.rerender(<MapScene {...props} />);
	};
	return { ...result, onEnterNode, onHoverNode, onOpenSettings, update };
}

function nodeById(id: string): WorldNode {
	const node = ACT_1.nodes.find((n) => n.id === id);
	if (!node) throw new Error(`no node ${id} in act 1`);
	return node;
}
function nodeButton(id: string) {
	return screen.getByRole("button", {
		name: m.enter_node({ name: translateNodeName(nodeById(id)) }),
	});
}
function nodeFrame(id: string) {
	return narrow(nodeButton(id).parentElement, HTMLElement);
}
function hasBadge(id: string, icon: string) {
	return nodeFrame(id).querySelector(`svg.lucide-${icon}`) !== null;
}

const HOVERED = "shadow-[0_0_12px_rgba(255,255,255,0.5)]";
const STONE = "border-cyan-400/70";
const LOCKED = "border-white/15";

describe("MapScene — nodes", () => {
	it("draws one labelled button per node of the act, at its map position", () => {
		setup();
		for (const node of ACT_1.nodes) {
			const frame = nodeFrame(node.id);
			expect(frame.style.left).toBe(`${node.position.x * 100}%`);
			expect(frame.style.top).toBe(`${node.position.y * 100}%`);
		}
	});

	it("enters the clicked node", () => {
		const t = setup();
		fireEvent.click(nodeButton("forest_starter"));
		expect(t.onEnterNode).toHaveBeenCalledExactlyOnceWith("forest_starter");
	});

	it("reports hover on mouse and keyboard focus, and clears it on leave", () => {
		const t = setup();
		fireEvent.mouseEnter(nodeButton("forest_starter"));
		expect(t.onHoverNode).toHaveBeenLastCalledWith("forest_starter");
		fireEvent.mouseLeave(nodeButton("forest_starter"));
		expect(t.onHoverNode).toHaveBeenLastCalledWith(null);
		fireEvent.focus(nodeButton("city"));
		expect(t.onHoverNode).toHaveBeenLastCalledWith("city");
		fireEvent.blur(nodeButton("city"));
		expect(t.onHoverNode).toHaveBeenLastCalledWith(null);
	});

	it("highlights only the hovered node", () => {
		const t = setup();
		expect(nodeButton("forest_starter").className).not.toContain(HOVERED);
		t.update({ hoveredNodeId: "forest_starter" });
		expect(nodeButton("forest_starter").className).toContain(HOVERED);
		expect(nodeButton("city").className).not.toContain(HOVERED);
	});

	it("pins the current location and only it", () => {
		setup({ currentLocationNodeId: "forest_starter" });
		expect(hasBadge("forest_starter", "map-pin")).toBe(true);
		expect(hasBadge("city", "map-pin")).toBe(false);
	});

	it("checks off completed zones", () => {
		setup({ completedZoneIds: new Set(["forest_starter"]) });
		expect(hasBadge("forest_starter", "check")).toBe(true);
		expect(hasBadge("forest_profunda", "check")).toBe(false);
	});
});

describe("MapScene — gates", () => {
	it("locks a node until every zone gating it is complete", () => {
		const t = setup();
		expect(hasBadge("forest_profunda", "lock")).toBe(true);
		expect(nodeButton("forest_profunda").className).toContain(LOCKED);
		t.update({ completedZoneIds: new Set(["forest_starter"]) });
		expect(hasBadge("forest_profunda", "lock")).toBe(false);
		expect(nodeButton("forest_profunda").className).not.toContain(LOCKED);
	});

	it("never locks an ungated node or the city", () => {
		setup();
		expect(hasBadge("city", "lock")).toBe(false);
		expect(hasBadge("forest_starter", "lock")).toBe(false);
	});

	it("keeps a locked node dim even while hovered, and still clickable", () => {
		const t = setup({ hoveredNodeId: "forest_profunda" });
		expect(nodeButton("forest_profunda").className).toContain(LOCKED);
		expect(nodeButton("forest_profunda").className).not.toContain(HOVERED);
		fireEvent.click(nodeButton("forest_profunda"));
		expect(t.onEnterNode).toHaveBeenCalledExactlyOnceWith("forest_profunda");
	});
});

describe("MapScene — teleport stone reach", () => {
	const unlocked = new Set(["city", "forest_starter", "forest_profunda"]);
	const completed = new Set(["forest_starter"]);

	it("marks an unlocked node out of walking range when a stone is held", () => {
		setup({
			hasTeleportStone: true,
			unlockedNodeIds: unlocked,
			completedZoneIds: completed,
		});
		expect(nodeButton("forest_profunda").className).toContain(STONE);
	});

	it("leaves the current node and its neighbours unmarked", () => {
		setup({
			hasTeleportStone: true,
			unlockedNodeIds: unlocked,
			completedZoneIds: completed,
		});
		expect(nodeButton("city").className).not.toContain(STONE);
		expect(nodeButton("forest_starter").className).not.toContain(STONE);
	});

	it("leaves a node not yet unlocked unmarked", () => {
		setup({
			hasTeleportStone: true,
			unlockedNodeIds: unlocked,
			completedZoneIds: new Set(["forest_starter", "forest_profunda"]),
		});
		expect(nodeButton("pantano").className).not.toContain(STONE);
	});

	it("marks nothing without a stone", () => {
		setup({ unlockedNodeIds: unlocked, completedZoneIds: completed });
		expect(nodeButton("forest_profunda").className).not.toContain(STONE);
	});

	it("gives way to the hover highlight", () => {
		setup({
			hasTeleportStone: true,
			unlockedNodeIds: unlocked,
			completedZoneIds: completed,
			hoveredNodeId: "forest_profunda",
		});
		expect(nodeButton("forest_profunda").className).toContain(HOVERED);
		expect(nodeButton("forest_profunda").className).not.toContain(STONE);
	});
});

describe("MapScene — edges", () => {
	const node = (
		id: string,
		x: number,
		connections: string[],
		kind: WorldNode["kind"] = "combat",
	): WorldNode => ({
		id,
		name: id,
		kind,
		position: { x, y: 0.5 },
		connections: connections.map((c) => ({ id: c, distance: 1 })),
	});

	it("draws each connection once, from node to node", () => {
		const act: Act = {
			id: "test",
			name: "Test",
			nodes: [
				node("a", 0.1, ["b"], "city"),
				node("b", 0.5, ["a", "c"]),
				node("c", 0.9, ["b", "ghost"]),
			],
		};
		const { container } = setup({ act, currentLocationNodeId: "a" });
		const lines = [...container.querySelectorAll("svg > line")];
		expect(
			lines.map((l) => [l.getAttribute("x1"), l.getAttribute("x2")]),
		).toEqual([
			["10%", "50%"],
			["50%", "90%"],
		]);
	});
});

describe("MapScene — corner buttons", () => {
	it("opens the settings", () => {
		const t = setup();
		fireEvent.click(screen.getByRole("button", { name: m.open_settings() }));
		expect(t.onOpenSettings).toHaveBeenCalledOnce();
	});

	it("shows the leaderboard button only when it has a handler", () => {
		const t = setup();
		expect(
			screen.queryByRole("button", { name: m.leaderboard_title() }),
		).toBeNull();
		const onOpenLeaderboard = vi.fn<() => void>();
		t.update({ onOpenLeaderboard });
		fireEvent.click(
			screen.getByRole("button", { name: m.leaderboard_title() }),
		);
		expect(onOpenLeaderboard).toHaveBeenCalledOnce();
	});
});
