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
	stops: [
		{ kind: "encounter", atMs: 2000, monsterId: "goblin", pack: null },
		{ kind: "camp", atMs: 5000, campIndex: 0 },
		{ kind: "encounter", atMs: 8000, monsterId: "lich", pack: 0 },
		{ kind: "encounter", atMs: 8200, monsterId: "lich", pack: 0 },
		{ kind: "exit", atMs: 20_000 },
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
		...root.querySelectorAll<HTMLElement>(`[data-kind="${kind}"]`),
	];
	return { root, all };
}

afterEach(() => {
	cleanup();
});

describe("ZonePath", () => {
	it("lays out one tile per path cell, ending at the exit", () => {
		const layout = rollPathLayout(ROUTE.budgetMs, seededRng(3));
		const { all } = renderPath();
		expect(all("tile")).toHaveLength(layout.cells.length - 1);
		expect(all("exit")).toHaveLength(1);
	});

	it("marks every upcoming encounter in its monster's color", () => {
		const { all } = renderPath();
		const enemies = all("enemy");
		expect(enemies.map((e) => e.dataset.monster)).toEqual([
			"goblin",
			"lich",
			"lich",
		]);
		const swatch = document.createElement("span");
		swatch.style.backgroundColor = MONSTERS.lich.pathColor;
		expect(enemies[1].style.backgroundColor).toBe(swatch.style.backgroundColor);
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
		const layout = rollPathLayout(ROUTE.budgetMs, seededRng(3));
		const first = layout.cells[0];
		const last = layout.cells.at(-1) ?? first;
		const at = (elapsedMs: number) => {
			const { all } = renderPath({ elapsedMs });
			const [player] = all("player");
			cleanup();
			return [player.style.left, player.style.top];
		};
		const pct = (v: number, size: number) => `${((v + 0.5) / size) * 100}%`;
		expect(at(0)).toEqual([
			pct(first.x, layout.cols),
			pct(first.y, layout.rows),
		]);
		expect(at(ROUTE.budgetMs)).toEqual([
			pct(last.x, layout.cols),
			pct(last.y, layout.rows),
		]);
	});
});
