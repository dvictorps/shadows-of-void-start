// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { narrow } from "#/components/dom-test-utils";
import type { LeaderboardQuery, LeaderboardSnapshot } from "#/lib/api-types";
import { intlLocale } from "#/lib/format";
import { m } from "#/paraglide/messages";

import LeaderboardModal from "./LeaderboardModal";

type Props = Parameters<typeof LeaderboardModal>[0];
type Entry = LeaderboardSnapshot["entries"][number];

afterEach(cleanup);

function entry(id: number, overrides: Partial<Entry> = {}): Entry {
	return {
		characterId: id,
		characterName: `Hero ${id}`,
		classId: "warrior",
		level: 10,
		xp: 0,
		totalBossKills: 0,
		hardcore: false,
		dead: false,
		...overrides,
	};
}

const UPDATED_AT = Date.UTC(2026, 10, 16, 14, 30);

function snapshot(entries: Entry[]): LeaderboardSnapshot {
	return {
		category: "level",
		mode: "softcore",
		entries,
		updatedAt: UPDATED_AT,
	};
}

function setup(overrides: Partial<Props> = {}) {
	const onClose = vi.fn<() => void>();
	const onQueryChange = vi.fn<(query: LeaderboardQuery) => void>();
	let props: Props = {
		isOpen: true,
		onClose,
		snapshot: snapshot([]),
		query: { category: "level", mode: "softcore" },
		onQueryChange,
		...overrides,
	};
	const result = render(<LeaderboardModal {...props} />);
	const update = (next: Partial<Props>) => {
		props = { ...props, ...next };
		result.rerender(<LeaderboardModal {...props} />);
	};
	return { onClose, onQueryChange, update };
}

const tab = (name: string) => screen.getByRole("button", { name });

function rows() {
	return screen
		.getAllByRole("row")
		.slice(1)
		.map((r) => [...r.querySelectorAll("td")].map((c) => c.textContent));
}

describe("LeaderboardModal — tabs", () => {
	it("renders nothing while closed", () => {
		setup({ isOpen: false });
		expect(screen.queryByText(m.leaderboard_title())).toBeNull();
	});

	it("marks the active category and mode", () => {
		setup({ query: { category: "bossKills", mode: "hardcore" } });
		expect(tab(m.leaderboard_kills_tab()).getAttribute("aria-pressed")).toBe(
			"true",
		);
		expect(tab(m.leaderboard_level_tab()).getAttribute("aria-pressed")).toBe(
			"false",
		);
		expect(tab(m.leaderboard_hardcore()).getAttribute("aria-pressed")).toBe(
			"true",
		);
	});

	it("asks for the other category, keeping the mode", () => {
		const t = setup({ query: { category: "level", mode: "hardcore" } });
		fireEvent.click(tab(m.leaderboard_kills_tab()));
		expect(t.onQueryChange).toHaveBeenCalledWith({
			category: "bossKills",
			mode: "hardcore",
		});
	});

	it("asks for the other mode, keeping the category", () => {
		const t = setup({ query: { category: "bossKills", mode: "softcore" } });
		fireEvent.click(tab(m.leaderboard_hardcore()));
		expect(t.onQueryChange).toHaveBeenCalledWith({
			category: "bossKills",
			mode: "hardcore",
		});
	});

	it("closes on Escape", () => {
		const t = setup();
		fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
		expect(t.onClose).toHaveBeenCalledTimes(1);
	});
});

describe("LeaderboardModal — table", () => {
	it("ranks the level entries with name, class and level", () => {
		setup({
			snapshot: snapshot([
				entry(1, { level: 30, classId: "mage" }),
				entry(2, { level: 20, classId: "rogue" }),
			]),
		});
		expect(screen.getByText(m.leaderboard_level())).toBeTruthy();
		expect(rows()).toEqual([
			["1", "Hero 1", m.class_mage_name(), "30"],
			["2", "Hero 2", m.class_rogue_name(), "20"],
		]);
	});

	it("shows boss kills under the kills category", () => {
		setup({
			query: { category: "bossKills", mode: "softcore" },
			snapshot: snapshot([entry(1, { level: 30, totalBossKills: 4 })]),
		});
		expect(screen.getByText(m.leaderboard_kills())).toBeTruthy();
		expect(rows()).toEqual([["1", "Hero 1", m.class_warrior_name(), "4"]]);
	});

	it("shows the empty state with no entries", () => {
		setup({ snapshot: snapshot([]) });
		expect(screen.getByText(m.leaderboard_empty())).toBeTruthy();
	});

	it("says loading while the snapshot loads", () => {
		setup({ snapshot: undefined });
		expect(screen.getByText(m.loading())).toBeTruthy();
		expect(screen.queryByText(m.leaderboard_empty())).toBeNull();
	});

	it("says the load failed when the query errored", () => {
		setup({ snapshot: undefined, failed: true });
		expect(screen.getByText(m.leaderboard_load_failed())).toBeTruthy();
		expect(screen.queryByText(m.loading())).toBeNull();
	});

	it("shows the empty state when no snapshot exists yet", () => {
		setup({ snapshot: null });
		expect(screen.getByText(m.leaderboard_empty())).toBeTruthy();
	});

	it("shows the snapshot's time", () => {
		setup();
		expect(
			screen.getByText(new Date(UPDATED_AT).toLocaleTimeString(intlLocale())),
		).toBeTruthy();
	});
});

describe("LeaderboardModal — filters", () => {
	const mixed = snapshot([
		entry(1, { classId: "mage" }),
		entry(2, { classId: "rogue" }),
		entry(3, { classId: "mage" }),
	]);

	it("filters the level board by class, ranking within it", () => {
		setup({ snapshot: mixed });
		fireEvent.change(screen.getByRole("combobox"), {
			target: { value: "mage" },
		});
		expect(rows().map((r) => r.slice(0, 2))).toEqual([
			["1", "Hero 1"],
			["2", "Hero 3"],
		]);
	});

	it("has no class filter on the kills board", () => {
		setup({
			snapshot: mixed,
			query: { category: "bossKills", mode: "softcore" },
		});
		expect(screen.queryByRole("combobox")).toBeNull();
		expect(rows()).toHaveLength(3);
	});

	it("keeps the class filter for when the level board comes back", () => {
		const t = setup({ snapshot: mixed });
		fireEvent.change(screen.getByRole("combobox"), {
			target: { value: "rogue" },
		});
		t.update({ query: { category: "bossKills", mode: "softcore" } });
		expect(rows()).toHaveLength(3);
		t.update({ query: { category: "level", mode: "softcore" } });
		expect(rows().map((r) => r[1])).toEqual(["Hero 2"]);
	});

	const hardcore = snapshot([
		entry(1, { hardcore: true }),
		entry(2, { hardcore: true, dead: true }),
	]);

	it("hides the hardcore fallen until asked", () => {
		setup({
			snapshot: hardcore,
			query: { category: "level", mode: "hardcore" },
		});
		expect(rows().map((r) => r[1])).toEqual(["Hero 1"]);
		fireEvent.click(screen.getByRole("checkbox"));
		expect(rows().map((r) => r[1])).toEqual(["Hero 1", "Hero 2"]);
		const fallen = narrow(screen.getAllByRole("row").at(-1), HTMLElement);
		expect(fallen.className).toContain("opacity-50");
		expect(fallen.querySelector("svg")).not.toBeNull();
	});

	it("has no fallen toggle in softcore", () => {
		setup();
		expect(screen.queryByRole("checkbox")).toBeNull();
	});
});
