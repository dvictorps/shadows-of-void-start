// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { MONSTERS } from "#/game/monsters";
import type { ZoneRoute } from "#/game/world/zone-route";
import { seededRng } from "#/lib/rng";
import { m } from "#/paraglide/messages";

import { rollPathLayout } from "./path-layout";
import ZonePath from "./ZonePath";

type Props = ComponentProps<typeof ZonePath>;

const ROUTE: ZoneRoute = {
	budgetMs: 20_000,
	tiles: 21,
	stops: [
		{ kind: "encounter", tile: 2, atMs: 1500, monsterId: "goblin", pack: null },
		{ kind: "camp", tile: 5, atMs: 4500, campIndex: 0 },
		{ kind: "encounter", tile: 8, atMs: 7500, monsterId: "lich", pack: 0 },
		{ kind: "encounter", tile: 8, atMs: 7500, monsterId: "lich", pack: 0 },
		{ kind: "exit", tile: 20, atMs: 19_500 },
	],
};

function renderPath(overrides: Partial<Props> = {}) {
	const props: Props = {
		route: ROUTE,
		routeSeed: 3,
		nextStopIndex: 0,
		elapsedMs: 0,
		incenseCampsMs: [],
		...overrides,
	};
	render(<ZonePath {...props} />);
	const root = screen.getByRole("img", { name: m.zone_path_aria() });
	const all = (kind: string) => [
		...root.querySelectorAll<SVGElement>(`[data-kind="${kind}"]`),
	];
	return { root, all };
}

afterEach(() => {
	cleanup();
});

describe("ZonePath", () => {
	it("lays out one tile per path cell, ending at the exit", () => {
		const layout = rollPathLayout(ROUTE.tiles, seededRng(3));
		const { all } = renderPath();
		expect(all("tile")).toHaveLength(layout.cells.length - 1);
		expect(all("exit")).toHaveLength(1);
	});

	it("paints a zone with a tileset as one textured road over its ground", () => {
		const layout = rollPathLayout(ROUTE.tiles, seededRng(3));
		const { root, all } = renderPath({
			tileset: { road: "/road.png", ground: "/ground.png" },
		});
		expect(all("tile")).toHaveLength(0);
		expect(all("ground")).toHaveLength(1);
		const [road] = all("road");
		expect(road.getAttribute("d")?.match(/M/g)).toHaveLength(
			layout.cells.length,
		);
		expect(all("exit")).toHaveLength(1);
		const hrefs = [...root.querySelectorAll("pattern image")].map((image) =>
			image.getAttribute("href"),
		);
		expect(hrefs).toEqual(["/ground.png", "/road.png"]);
		expect(road.getAttribute("fill")).toMatch(/^url\(#road-/);
	});

	it("marks every upcoming encounter in its monster's color", () => {
		const { all } = renderPath();
		const enemies = all("enemy");
		expect(enemies.map((e) => e.dataset.monster)).toEqual([
			"goblin",
			"lich",
			"lich",
		]);
		expect(enemies[1].getAttribute("fill")).toBe(MONSTERS.lich.pathColor);
	});

	it("drops the encounters already behind the player and dims the used camp", () => {
		const { all } = renderPath({ nextStopIndex: 2, elapsedMs: 5000 });
		expect(all("enemy").map((e) => e.dataset.monster)).toEqual([
			"lich",
			"lich",
		]);
		expect(all("camp").map((c) => c.dataset.used)).toEqual(["true"]);
	});

	it("leaves a spent campfire where an incense was burned", () => {
		const { all } = renderPath({ incenseCampsMs: [3000] });
		expect(all("camp").map((c) => c.dataset.used)).toEqual(["false", "true"]);
	});

	it("walks the white dot from the entrance to the exit", () => {
		const layout = rollPathLayout(ROUTE.tiles, seededRng(3));
		const first = layout.cells[0];
		const last = layout.cells.at(-1) ?? first;
		const at = (elapsedMs: number) => {
			const { all } = renderPath({ elapsedMs });
			const [player] = all("player");
			cleanup();
			return player.style.transform;
		};
		const centre = (c: { x: number; y: number }) =>
			`translate(${c.x + 0.5}px, ${c.y + 0.5}px)`;
		expect(at(0)).toBe(centre(first));
		expect(at(ROUTE.budgetMs)).toBe(centre(last));
	});

	it("draws each enemy on its stop's tile, reached by the walker as the fight starts", () => {
		const layout = rollPathLayout(ROUTE.tiles, seededRng(3));
		const [goblin] = ROUTE.stops;
		const tile = layout.cells[goblin.tile];
		const before = layout.cells[goblin.tile - 1];
		const { all } = renderPath({ elapsedMs: goblin.atMs });
		const [dot] = all("enemy");
		expect(dot.getAttribute("transform")).toBe(
			`translate(${tile.x + 0.5} ${tile.y + 0.5})`,
		);
		const [player] = all("player");
		const edge = {
			x: (before.x + tile.x) / 2 + 0.5,
			y: (before.y + tile.y) / 2 + 0.5,
		};
		expect(player.style.transform).toBe(`translate(${edge.x}px, ${edge.y}px)`);
	});

	it("fits the whole path in view, whatever its size", () => {
		const layout = rollPathLayout(ROUTE.tiles, seededRng(3));
		const { root } = renderPath();
		const [, , w, h] = (root.getAttribute("viewBox") ?? "")
			.split(" ")
			.map(Number);
		expect(w).toBeGreaterThanOrEqual(layout.cols);
		expect(h).toBeGreaterThanOrEqual(layout.rows);
		expect(root.getAttribute("preserveAspectRatio")).toBe("xMidYMid meet");
	});
});
