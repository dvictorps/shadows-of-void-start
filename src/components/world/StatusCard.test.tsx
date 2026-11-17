// @vitest-environment jsdom

// What the sidebar's status card renders and which callback each control
// makes: the name / class / level / DPS block, the attribute readouts and
// their tooltips, the XP bar, the potion and teleport slots (count, when each
// is enabled), the Show stats button, the health globe and the compact
// layout. Pure render: props in,
// DOM out; expected text comes from the same renderers (`m.*`,
// `estimateDps`, `xpToNextLevel`), not literals.
//
// - The tooltips are Radix: they need a Provider, and open on focus.
// - jsdom has no `matchMedia` (useCompactViewport); a stub answers "wide"
//   unless a test sets `compact`.

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

import { narrow } from "#/components/dom-test-utils";
import { getClassDisplayName } from "#/game/classes/i18n";
import { xpToNextLevel } from "#/game/progression/levels";
import {
	DEX_ACCURACY_PER_POINT,
	DEX_EVASION_PCT_PER_POINT,
	INT_BARRIER_PCT_PER_POINT,
	STR_LIFE_PER_POINT,
	STR_MELEE_PCT_PER_POINT,
} from "#/game/stats/compute";
import { estimateDps } from "#/game/stats/dps";
import { makeStats } from "#/hooks/combat-test-fixtures";
import { m } from "#/paraglide/messages";

import { characterRow } from "./character-test-fixtures";
import StatusCard from "./StatusCard";

type Props = Parameters<typeof StatusCard>[0];

let compact = false;

beforeAll(() => {
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: (query: string) => ({
			matches: compact,
			media: query,
			addEventListener: () => {},
			removeEventListener: () => {},
		}),
	});
});

afterAll(() => {
	Reflect.deleteProperty(window, "matchMedia");
});

beforeEach(() => {
	compact = false;
});

afterEach(cleanup);

function setup(overrides: Partial<Props> = {}) {
	const onUsePotion = vi.fn<() => void>();
	const onUseTeleportStone = vi.fn<() => void>();
	const onShowStats = vi.fn<() => void>();
	const props: Props = {
		character: characterRow(),
		stats: makeStats(),
		teleportStones: 0,
		onUsePotion,
		onUseTeleportStone,
		onShowStats,
		...overrides,
	};
	const result = render(
		<TooltipPrimitive.Provider delayDuration={0}>
			<StatusCard {...props} />
		</TooltipPrimitive.Provider>,
	);
	return { ...result, props, onUsePotion, onUseTeleportStone, onShowStats };
}

const potionSlot = () =>
	narrow(
		screen.getByRole("button", { name: m.potion_use_aria() }),
		HTMLButtonElement,
	);
const teleportSlot = () =>
	narrow(
		screen.getByRole("button", { name: m.teleport_use_aria() }),
		HTMLButtonElement,
	);
const xpBar = () => screen.getByRole("progressbar", { name: m.xp_bar_aria() });
const showButton = () =>
	narrow(
		screen.getByRole("button", { name: m.show_action() }),
		HTMLButtonElement,
	);
const globe = () => screen.getByRole("img", { name: m.health_globe_aria() });

/** The line whose label span reads `label`, e.g. "Level:". */
function line(label: string) {
	return narrow(screen.getByText(label).parentElement, HTMLElement);
}

async function focus(node: HTMLElement) {
	await act(async () => {
		fireEvent.focus(node);
	});
}

describe("StatusCard — identity block", () => {
	it("shows the name, the class, the level and the DPS estimate", () => {
		const stats = makeStats();
		setup({
			character: characterRow({ name: "Aldra", classId: "mage", level: 12 }),
			stats,
		});
		expect(screen.getByRole("heading", { name: "Aldra" })).toBeTruthy();
		expect(line(m.status_class_label()).textContent).toBe(
			`${m.status_class_label()} ${getClassDisplayName("mage")}`,
		);
		expect(line(m.status_level_label()).textContent).toBe(
			`${m.status_level_label()} 12`,
		);
		expect(estimateDps(stats)).toBeGreaterThan(0);
		expect(line(m.status_dps_label()).textContent).toBe(
			`${m.status_dps_label()} ${estimateDps(stats)}`,
		);
	});

	it("shows a dash for zero DPS", () => {
		setup({ stats: makeStats({ swings: [] }) });
		expect(line(m.status_dps_label()).textContent).toBe(
			`${m.status_dps_label()} —`,
		);
	});
});

describe("StatusCard — attributes", () => {
	it("shows strength, dexterity and intelligence with their glow", () => {
		setup({
			stats: makeStats({
				attributes: { strength: 21, dexterity: 13, intelligence: 8 },
			}),
		});
		const str = screen.getByText(`${m.status_strength_label()} 21`);
		const dex = screen.getByText(`${m.status_dexterity_label()} 13`);
		const int = screen.getByText(`${m.status_intelligence_label()} 8`);
		expect(str.className).toContain("text-glow-red");
		expect(dex.className).toContain("text-glow-green");
		expect(int.className).toContain("text-glow-blue");
	});

	it("explains what a point of each attribute does on focus", async () => {
		setup({
			stats: makeStats({
				attributes: { strength: 21, dexterity: 13, intelligence: 8 },
			}),
		});
		const cases = [
			[
				`${m.status_strength_label()} 21`,
				m.attribute_tooltip_strength({
					melee: STR_MELEE_PCT_PER_POINT,
					life: STR_LIFE_PER_POINT,
				}),
			],
			[
				`${m.status_dexterity_label()} 13`,
				m.attribute_tooltip_dexterity({
					accuracy: DEX_ACCURACY_PER_POINT,
					evasion: DEX_EVASION_PCT_PER_POINT,
				}),
			],
			[
				`${m.status_intelligence_label()} 8`,
				m.attribute_tooltip_intelligence({
					barrier: INT_BARRIER_PCT_PER_POINT,
				}),
			],
		] as const;
		for (const [readout, tooltip] of cases) {
			await focus(screen.getByText(readout));
			// Multi-line text: compare whole nodes, not the normalized default.
			expect(
				screen.getAllByText((_, node) => node?.textContent === tooltip).length,
			).toBeGreaterThan(0);
		}
	});
});

describe("StatusCard — XP bar", () => {
	it("shows the character's XP against the next level's need", () => {
		const needed = xpToNextLevel(3);
		setup({ character: characterRow({ level: 3, xp: 40 }) });
		expect(
			screen.getByText(m.status_xp_label({ current: 40, needed })),
		).toBeTruthy();
		const bar = xpBar();
		expect(bar.getAttribute("aria-valuenow")).toBe("40");
		expect(bar.getAttribute("aria-valuemax")).toBe(String(needed));
	});

	it("prefers the XP override over the row", () => {
		setup({ character: characterRow({ xp: 40 }), xpOverride: 55 });
		expect(xpBar().getAttribute("aria-valuenow")).toBe("55");
	});
});

describe("StatusCard — potion slot", () => {
	const hurt = { character: characterRow({ potions: 3 }), hpOverride: 50 };

	it("shows the potion count and drinks on click", () => {
		const t = setup(hurt);
		expect(potionSlot().textContent).toBe("3");
		expect(potionSlot().disabled).toBe(false);
		fireEvent.click(potionSlot());
		expect(t.onUsePotion).toHaveBeenCalledTimes(1);
	});

	it("prefers the potions override over the row", () => {
		setup({ ...hurt, potionsOverride: 1 });
		expect(potionSlot().textContent).toBe("1");
	});

	it("is disabled with no potions", () => {
		setup({ ...hurt, character: characterRow({ potions: 0 }) });
		expect(potionSlot().disabled).toBe(true);
	});

	it("is disabled at full life", () => {
		setup({ ...hurt, hpOverride: 100 });
		expect(potionSlot().disabled).toBe(true);
	});

	it("is disabled without a handler", () => {
		setup({ ...hurt, onUsePotion: undefined });
		expect(potionSlot().disabled).toBe(true);
	});

	it("reads life from the row when there is no override", () => {
		setup({ character: characterRow({ potions: 3, hpCurrent: 60 }) });
		expect(potionSlot().disabled).toBe(false);
	});

	it("describes the potion on focus", async () => {
		setup(hurt);
		await focus(potionSlot());
		expect(
			screen.getAllByText(m.consumable_desc_potion()).length,
		).toBeGreaterThan(0);
	});
});

describe("StatusCard — teleport slot", () => {
	const outside = {
		character: characterRow({ currentLocation: "zone_1" }),
		teleportStones: 2,
	};

	it("shows the stone count and teleports on click", () => {
		const t = setup(outside);
		expect(teleportSlot().textContent).toBe("2");
		expect(teleportSlot().disabled).toBe(false);
		fireEvent.click(teleportSlot());
		expect(t.onUseTeleportStone).toHaveBeenCalledTimes(1);
	});

	it("is disabled in the city", () => {
		setup({ ...outside, character: characterRow({ currentLocation: "city" }) });
		expect(teleportSlot().disabled).toBe(true);
	});

	it("is disabled with no stones", () => {
		setup({ ...outside, teleportStones: 0 });
		expect(teleportSlot().disabled).toBe(true);
	});

	it("is disabled without a handler", () => {
		setup({ ...outside, onUseTeleportStone: undefined });
		expect(teleportSlot().disabled).toBe(true);
	});

	it("is enabled at full life (unlike the potion)", () => {
		setup({ ...outside, hpOverride: 100 });
		expect(teleportSlot().disabled).toBe(false);
	});

	it("wears the same frame as the potion slot", () => {
		setup(outside);
		expect(teleportSlot().className).toBe(potionSlot().className);
	});

	it("describes the stone on focus", async () => {
		setup(outside);
		await focus(teleportSlot());
		expect(
			screen.getAllByText(m.consumable_desc_teleport()).length,
		).toBeGreaterThan(0);
	});
});

describe("StatusCard — stats button", () => {
	it("opens the stats under the Status caption", () => {
		const t = setup();
		expect(screen.getByText(m.status_header())).toBeTruthy();
		fireEvent.click(showButton());
		expect(t.onShowStats).toHaveBeenCalledTimes(1);
	});

	it("is disabled without a handler", () => {
		setup({ onShowStats: undefined });
		expect(showButton().disabled).toBe(true);
	});
});

describe("StatusCard — health globe", () => {
	it("shows the life override against max life", () => {
		setup({ hpOverride: 42.2 });
		expect(globe().textContent).toContain("43/100");
	});

	it("falls back to the row's life", () => {
		setup({ character: characterRow({ hpCurrent: 70 }) });
		expect(globe().textContent).toContain("70/100");
	});

	it("shows the barrier override against max barrier", () => {
		setup({ stats: makeStats({ maxBarrier: 30 }), barrierOverride: 12 });
		expect(globe().textContent).toContain("12/30");
	});

	it("shows a full barrier without an override", () => {
		setup({ stats: makeStats({ maxBarrier: 30 }) });
		expect(globe().textContent).toContain("30/30");
	});

	it("hides the barrier line with no max barrier", () => {
		setup();
		expect(globe().textContent).toBe("100/100");
	});

	it("draws the refill ring while the barrier is recharging", () => {
		setup({
			stats: makeStats({ maxBarrier: 30 }),
			barrierOverride: 0,
			barrierRefillRemaining: 1,
		});
		expect(globe().querySelector("circle")).not.toBeNull();
	});
});

describe("StatusCard — layout", () => {
	it("uses the roomy sizes on a wide viewport", () => {
		const { container } = setup();
		expect(
			narrow(container.querySelector("section"), HTMLElement).className,
		).toContain("p-4");
		expect(screen.getByRole("heading").className).toContain("text-2xl");
		expect(potionSlot().className).toContain("h-16 w-16");
		expect(teleportSlot().className).toContain("h-16 w-16");
	});

	it("shrinks on a compact viewport", () => {
		compact = true;
		const { container } = setup();
		expect(
			narrow(container.querySelector("section"), HTMLElement).className,
		).toContain("p-2");
		expect(screen.getByRole("heading").className).toContain("text-lg");
		expect(potionSlot().className).toContain("h-11 w-11");
		expect(teleportSlot().className).toContain("h-11 w-11");
	});
});
