// @vitest-environment jsdom

// What the combat scene renders and emits in each state of the loop: the
// fixed HUD, exploration and ambush, the fight (nameplate, HP bar, damage
// popups, tooltip), the rare and boss intro cascades, victory and the zone
// complete panel, the camp cinematic, and the consumables. The safety net for
// the CombatScene split (docs/plans/in-progress.md → agent-ergonomics item 4).
//
// - State comes in as props and callbacks are `vi.fn()`, the way CombatPane
//   wires them. No module mocks: framer-motion, the camp cinematic and the
//   element selector all run for real.
// - Time runs on fake timers. framer-motion's frame loop rides the faked
//   requestAnimationFrame, so after `advance()` an animated element carries
//   its target `style.opacity`. The camp cinematic chains a timer per stage,
//   so `advance()` steps in small slices, each inside its own `act`.
// - Death is not here: CombatScene has no death state (the route owns it).

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";

import { GRALFOR } from "#/game/bosses/gralfor";
import { ELEMENT_SWITCH_COOLDOWN_MS } from "#/game/combat/constants";
import type { Enemy } from "#/game/combat/types";
import { MONSTERS } from "#/game/monsters";
import {
	translateCampLines,
	translateEnemyName,
	translateMonsterModDescription,
} from "#/game/world/i18n";
import { type EnemyOverrides, makeEnemy } from "#/hooks/combat-test-fixtures";
import type { DamageEvent } from "#/hooks/useDamageEvents";
import { setGlobalSfxVolume } from "#/lib/sfx";
import { m } from "#/paraglide/messages";

import CombatScene, { type ConsumableKey } from "./CombatScene";

type Props = ComponentProps<typeof CombatScene>;
type SwitchElement = NonNullable<Props["onSwitchElement"]>;

/** Narrows a queried node to `type`, failing the test when the DOM moved. */
function narrow<T extends Element>(
	node: Element | null | undefined,
	type: abstract new (...args: never[]) => T,
): T {
	if (!(node instanceof type)) {
		throw new Error(
			`expected a ${type.name}, got ${node?.tagName ?? "nothing"}`,
		);
	}
	return node;
}

const ZONE_ID = "forest_starter";

function baseProps(): Props {
	return {
		zoneName: "Whispering Woods",
		zoneLevel: 2,
		state: "searching",
		isBossNode: false,
		rareIntroStage: null,
		bossIntroStage: null,
		enemy: null,
		events: [],
		playerHp: 50,
		maxHp: 100,
		barrier: 0,
		maxBarrier: 0,
		xp: 30,
		xpNeeded: 120,
		potions: 3,
		canUsePotion: true,
		onUsePotion: vi.fn<() => void>(),
		teleportStones: 2,
		canUseTeleportStone: true,
		onUseTeleportStone: vi.fn<() => void>(),
		incense: 1,
		canUseIncense: true,
		onUseIncense: vi.fn<() => void>(),
		campSource: "baked",
		ambushActive: false,
		onRetreat: vi.fn<() => void>(),
		bagCount: 0,
		onOpenBag: vi.fn<() => void>(),
		onConsumableHover: vi.fn<(key: ConsumableKey | null) => void>(),
		calmariaElapsedMs: 2500,
		calmariaBudgetMs: 10_000,
		campThresholdsMs: [],
		onDismissMinibossModal: vi.fn<() => void>(),
		zoneId: ZONE_ID,
		onDismissCamp: vi.fn<() => void>(),
	};
}

function renderScene(overrides: Partial<Props> = {}) {
	let props: Props = { ...baseProps(), ...overrides };
	const result = render(<CombatScene {...props} />);
	return {
		...result,
		get props() {
			return props;
		},
		section: () =>
			narrow(result.container.querySelector("section"), HTMLElement),
		update(next: Partial<Props>) {
			props = { ...props, ...next };
			result.rerender(<CombatScene {...props} />);
		},
	};
}

/** Runs fake time forward in slices so chained timers each commit. */
async function advance(ms: number, slice = 100) {
	for (let elapsed = 0; elapsed < ms; elapsed += slice) {
		await act(async () => {
			await vi.advanceTimersByTimeAsync(slice);
		});
	}
}

// Covers the scene's longest transition (the XP popup, 0.8 s).
const SETTLE_MS = 800;

// When each camp beat is on screen, from CampCinematic's pacing (line holds
// of 2 s / 3 s / 3 s, each line's 1.2 s exit before the next shows, 2.2 s of
// exit + pause before the panel), plus 100 ms of slack.
const CAMP_LINE_2_SHOWN_MS = 3300;
const CAMP_LINE_3_SHOWN_MS = 6300;
const CAMP_PANEL_SHOWN_MS = 10_300;

/** A level-3 goblin at 12 / 20 HP. */
function goblin(overrides: EnemyOverrides = {}): Enemy {
	return makeEnemy(20, {
		def: MONSTERS.goblin,
		currentHp: 12,
		level: 3,
		...overrides,
	});
}

function gralfor(overrides: EnemyOverrides = {}): Enemy {
	return makeEnemy(300, {
		def: GRALFOR.template,
		rarity: "unique",
		level: GRALFOR.level,
		...overrides,
	});
}

let eventSeq = 0;
function ev(overrides: Partial<DamageEvent>): DamageEvent {
	eventSeq += 1;
	return { id: `ev-${eventSeq}`, amount: 7, target: "enemy", ...overrides };
}

// The nameplate and HP bar stay mounted while an enemy is present; their
// visibility is the opacity framer-motion animates them to.
function nameplate(enemy: Enemy) {
	return narrow(
		screen.getAllByText(`Lv ${enemy.level}`)[0].parentElement,
		HTMLElement,
	);
}
function hpBar(enemy: Enemy) {
	const text = screen.getByText(
		`${Math.ceil(enemy.currentHp)} / ${enemy.scaled.hp}`,
	);
	return narrow(text.parentElement?.parentElement, HTMLElement);
}
// The element carrying the sprite's mouseenter / mouseleave.
function spriteHoverTarget(enemy: Enemy) {
	const sprite = screen.getByRole("img", { name: translateEnemyName(enemy) });
	return narrow(sprite.parentElement?.parentElement, HTMLElement);
}
function healthGlobeArea() {
	return narrow(
		screen.getByRole("img", { name: "Health and barrier" }).parentElement,
		HTMLElement,
	);
}

// One fake clock for the whole file. framer-motion's frame loop is a module
// singleton: once it has requested a frame, it waits for that frame before
// scheduling another, so swapping the clock between tests (which drops the
// pending requestAnimationFrame) would freeze every later animation.
beforeAll(() => {
	vi.useFakeTimers();
	setGlobalSfxVolume(0);
});

afterAll(() => {
	vi.useRealTimers();
});

// Vitest runs without globals, so Testing Library can't register its own
// unmount between tests.
afterEach(() => {
	cleanup();
});

describe("CombatScene — fixed HUD", () => {
	it("shows the zone name and its static level", () => {
		renderScene();
		expect(screen.getByText("Whispering Woods")).toBeTruthy();
		expect(screen.getByText("LV 2")).toBeTruthy();
	});

	it("reports calmaria progress on the time bar, with a marker per camp", () => {
		renderScene({
			calmariaElapsedMs: 2500.4,
			calmariaBudgetMs: 10_000,
			campThresholdsMs: [3000, 6600],
		});
		const bar = screen.getByRole("progressbar", { name: "Zone time progress" });
		expect(bar.getAttribute("aria-valuenow")).toBe("2500");
		expect(bar.getAttribute("aria-valuemax")).toBe("10000");
		const markers = [...bar.querySelectorAll("span")];
		expect(markers.map((marker) => marker.style.left)).toEqual(["30%", "66%"]);
	});

	it("shows XP as text and on the experience bar", () => {
		renderScene({ xp: 30, xpNeeded: 120 });
		expect(screen.getByText("XP: 30 / 120")).toBeTruthy();
		const bar = screen.getByRole("progressbar", { name: "Experience" });
		expect(bar.getAttribute("aria-valuenow")).toBe("30");
		expect(bar.getAttribute("aria-valuemax")).toBe("120");
	});

	it("shows the player's HP on the health globe", () => {
		renderScene({ playerHp: 49.2, maxHp: 100 });
		expect(within(healthGlobeArea()).getByText("50/100")).toBeTruthy();
	});

	it("disables the loot button with no badge while the bag is empty", () => {
		const scene = renderScene({ bagCount: 0 });
		const loot = narrow(
			screen.getByRole("button", { name: "Loot bag (0 items)" }),
			HTMLButtonElement,
		);
		expect(loot.disabled).toBe(true);
		expect(loot.textContent).toBe("");
		fireEvent.click(loot);
		expect(scene.props.onOpenBag).not.toHaveBeenCalled();
	});

	it("badges the loot button with the bag count and opens the bag", () => {
		const scene = renderScene({ bagCount: 4 });
		const loot = screen.getByRole("button", { name: "Loot bag (4 items)" });
		expect(loot.textContent).toBe("4");
		fireEvent.click(loot);
		expect(scene.props.onOpenBag).toHaveBeenCalledTimes(1);
	});

	it("retreats from the Retreat button", () => {
		const scene = renderScene();
		const retreat = screen.getByRole("button", { name: m.retreat_to_map() });
		expect(retreat.textContent).toBe(m.retreat());
		fireEvent.click(retreat);
		expect(scene.props.onRetreat).toHaveBeenCalledTimes(1);
	});
});

describe("CombatScene — exploration and ambush", () => {
	it("shows the searching line with no enemy on screen", () => {
		renderScene({ state: "searching", enemy: null });
		expect(screen.getByText(m.searching_enemy())).toBeTruthy();
	});

	it("swaps the searching line for the ambush banner while a pack fires", async () => {
		const scene = renderScene({ state: "searching", ambushActive: true });
		expect(screen.getByText(m.ambush_banner())).toBeTruthy();
		expect(screen.queryByText(m.searching_enemy())).toBeNull();

		scene.update({ ambushActive: false });
		await advance(SETTLE_MS);
		expect(screen.queryByText(m.ambush_banner())).toBeNull();
		expect(screen.getByText(m.searching_enemy())).toBeTruthy();
	});
});

describe("CombatScene — fight", () => {
	it("shows the sprite, the nameplate and the HP bar of an engaged enemy", async () => {
		const enemy = goblin();
		renderScene({ state: "engaged", enemy });
		await advance(SETTLE_MS);
		const name = translateEnemyName(enemy);
		expect(screen.getByRole("img", { name })).toBeTruthy();
		expect(screen.getByText(name)).toBeTruthy();
		expect(nameplate(enemy).style.opacity).toBe("1");
		expect(hpBar(enemy).style.opacity).toBe("1");
		expect(screen.queryByText(m.searching_enemy())).toBeNull();
	});

	it.each([
		["normal", "rgb(255, 255, 255)"],
		["magic", "rgb(136, 136, 255)"],
		["rare", "rgb(255, 255, 119)"],
	] as const)("tints a %s nameplate by rarity", (rarity, color) => {
		const enemy = goblin({ rarity });
		renderScene({ state: "engaged", enemy });
		expect(screen.getByText(translateEnemyName(enemy)).style.color).toBe(color);
	});

	it("uses the boss's own nameplate color and enlarges its sprite", () => {
		const enemy = gralfor();
		renderScene({ state: "engaged", enemy });
		const name = translateEnemyName(enemy);
		expect(name).toBe(m.boss_gralfor_name());
		expect(screen.getByText(name).style.color).toBe("rgb(255, 140, 58)");
		expect(spriteHoverTarget(enemy).firstElementChild?.classList).toContain(
			"scale-150",
		);
	});

	it("shows rounded-up enemy HP, and the barrier only when it has one", () => {
		const scene = renderScene({
			state: "engaged",
			enemy: goblin({ currentHp: 11.2 }),
		});
		expect(screen.getByText("12 / 20")).toBeTruthy();
		expect(screen.queryByText(/^\+ /)).toBeNull();

		scene.update({
			enemy: goblin({ currentBarrier: 3.4, scaled: { barrier: 8 } }),
		});
		expect(screen.getByText("+ 4 / 8")).toBeTruthy();
	});

	it("labels each kind of damage popup", () => {
		renderScene({
			state: "engaged",
			enemy: goblin(),
			events: [
				ev({ isMiss: true, isCrit: true }),
				ev({ isBlocked: true }),
				ev({ amount: 40, isCrit: true }),
				ev({ amount: 5, isThorns: true }),
				ev({ amount: 9 }),
				ev({ amount: 6.4, isHealing: true, target: "player" }),
				ev({ amount: 0.3, isHealing: true, target: "player" }),
			],
		});
		expect(screen.getByText("MISS").classList).toContain("text-white/60");
		expect(screen.getByText("BLOCK").classList).toContain("text-blue-300");
		expect(screen.getByText("40!!!").classList).toContain("text-red-500");
		expect(screen.getByText("5").classList).toContain("text-purple-300");
		expect(screen.getByText("9").classList).toContain("text-white");
		expect(screen.getByText("+6").classList).toContain("text-green-400");
		// A heal that rounds to zero renders nothing.
		expect(screen.queryByText("+0")).toBeNull();
	});

	it("floats enemy hits over the sprite and player hits over the globe", () => {
		renderScene({
			state: "engaged",
			enemy: goblin(),
			events: [ev({ amount: 31 }), ev({ amount: 17, target: "player" })],
		});
		const globe = healthGlobeArea();
		expect(within(globe).queryByText("31")).toBeNull();
		const playerHit = within(globe).getByText("17");
		expect(playerHit.classList).toContain("text-red-400");
		expect(screen.getByText("31").classList).toContain("text-white");
	});

	it("opens the monster tooltip on hover for a magic enemy", () => {
		const enemy = goblin({ rarity: "magic", mods: ["monsterIncreasedLife"] });
		renderScene({ state: "engaged", enemy });
		const hoverTarget = spriteHoverTarget(enemy);
		const modLine = translateMonsterModDescription(
			"monsterIncreasedLife",
			enemy.scaled,
		);

		fireEvent.mouseEnter(hoverTarget);
		expect(screen.getByText(modLine)).toBeTruthy();
		fireEvent.mouseLeave(hoverTarget);
		expect(screen.queryByText(modLine)).toBeNull();
	});

	it("shows the boss's stat sheet on hover", () => {
		const enemy = gralfor();
		renderScene({ state: "engaged", enemy });
		fireEvent.mouseEnter(spriteHoverTarget(enemy));
		expect(screen.getByText(m.stat_resistances())).toBeTruthy();
	});

	it("has no tooltip for a normal enemy", () => {
		const enemy = goblin();
		renderScene({ state: "engaged", enemy });
		fireEvent.mouseEnter(spriteHoverTarget(enemy));
		// Only the nameplate carries the level; the tooltip would repeat it.
		expect(screen.getAllByText("Lv 3")).toHaveLength(1);
	});
});

// Renders an intro stage, lets the reveal settle, and reads the cascade:
// the sprite is always up, the nameplate and HP bar by opacity.
async function introCascade(props: Partial<Props> & { enemy: Enemy }) {
	renderScene(props);
	await advance(SETTLE_MS);
	return {
		sprite: spriteHoverTarget(props.enemy).isConnected,
		name: nameplate(props.enemy).style.opacity,
		hp: hpBar(props.enemy).style.opacity,
	};
}

describe("CombatScene — rare intro", () => {
	it.each([
		["sprite", "0", "0"],
		["name", "1", "0"],
		["hp", "1", "1"],
	] as const)(
		"at the %s stage shows the nameplate at %s and the HP bar at %s",
		async (stage, name, hp) => {
			const cascade = await introCascade({
				state: "rare_intro",
				rareIntroStage: stage,
				enemy: goblin({ rarity: "rare" }),
			});
			expect(cascade).toEqual({ sprite: true, name, hp });
		},
	);
});

describe("CombatScene — boss intro", () => {
	it.each([
		["sprite", "0", "0"],
		["impact", "0", "0"],
		["name", "1", "0"],
		["hp", "1", "1"],
	] as const)(
		"at the %s stage shows the nameplate at %s and the HP bar at %s",
		async (stage, name, hp) => {
			const cascade = await introCascade({
				state: "boss_intro",
				bossIntroStage: stage,
				isBossNode: true,
				enemy: gralfor(),
			});
			expect(cascade).toEqual({ sprite: true, name, hp });
		},
	);

	it("shakes the scene at the impact beat until the animation ends", () => {
		const scene = renderScene({
			state: "boss_intro",
			bossIntroStage: "sprite",
			isBossNode: true,
			enemy: gralfor(),
		});
		expect(scene.section().classList.contains("boss-screenshake")).toBe(false);

		scene.update({ bossIntroStage: "impact" });
		expect(scene.section().classList.contains("boss-screenshake")).toBe(true);

		fireEvent.animationEnd(scene.section());
		expect(scene.section().classList.contains("boss-screenshake")).toBe(false);
	});

	it("doesn't shake for a rare at the same beat name", () => {
		const scene = renderScene({
			state: "boss_intro",
			bossIntroStage: "impact",
			enemy: goblin({ rarity: "rare" }),
		});
		expect(scene.section().classList.contains("boss-screenshake")).toBe(false);
	});
});

describe("CombatScene — victory", () => {
	it("floats the kill's XP and fades the nameplate and HP bar", async () => {
		const enemy = goblin();
		const scene = renderScene({ state: "engaged", enemy });
		await advance(SETTLE_MS);

		scene.update({ state: "victory", lastKillXp: 7 });
		expect(screen.getByText("+7 XP")).toBeTruthy();
		await advance(SETTLE_MS);
		// The sprite stays mounted while it fades out.
		expect(
			screen.getByRole("img", { name: translateEnemyName(enemy) }),
		).toBeTruthy();
		expect(nameplate(enemy).style.opacity).toBe("0");
		expect(hpBar(enemy).style.opacity).toBe("0");

		scene.update({ state: "searching", enemy: null });
		await advance(SETTLE_MS);
		expect(screen.queryByText("+7 XP")).toBeNull();
	});

	it("has no XP popup without a recorded kill", () => {
		renderScene({ state: "victory", enemy: goblin(), lastKillXp: undefined });
		expect(screen.queryByText(/XP$/)).toBeNull();
	});
});

describe("CombatScene — zone complete", () => {
	it("replaces the enemy with the zone-complete panel after the miniboss", () => {
		const enemy = goblin({ rarity: "rare" });
		const scene = renderScene({ state: "miniboss_victory", enemy });
		expect(screen.getByText(m.zone_complete_title())).toBeTruthy();
		expect(screen.getByText(m.miniboss_modal_body())).toBeTruthy();
		expect(
			screen.queryByRole("img", { name: translateEnemyName(enemy) }),
		).toBeNull();
		expect(screen.queryByText("12 / 20")).toBeNull();

		fireEvent.click(
			screen.getByRole("button", { name: m.miniboss_modal_continue() }),
		);
		expect(scene.props.onDismissMinibossModal).toHaveBeenCalledTimes(1);
		fireEvent.click(
			screen.getByRole("button", { name: m.miniboss_modal_retreat() }),
		);
		expect(scene.props.onRetreat).toHaveBeenCalledTimes(1);
	});

	it("offers only the retreat on a boss node", () => {
		renderScene({
			state: "miniboss_victory",
			isBossNode: true,
			enemy: gralfor(),
		});
		expect(
			screen.queryByRole("button", { name: m.miniboss_modal_continue() }),
		).toBeNull();
		expect(
			screen.getByRole("button", { name: m.miniboss_modal_retreat() }),
		).toBeTruthy();
	});
});

describe("CombatScene — camp", () => {
	function hudFaded() {
		const label = screen.getByText("Whispering Woods").parentElement;
		const actions = screen.getByRole("button", {
			name: m.retreat_to_map(),
		}).parentElement;
		const bottom = screen.getByRole("button", { name: "Use potion" })
			.parentElement?.parentElement;
		const faded = [label, actions, bottom].map((el) =>
			narrow(el, HTMLElement).classList.contains("opacity-0"),
		);
		// The three HUD blocks fade together.
		expect(new Set(faded).size).toBe(1);
		return faded[0];
	}

	it("fades the HUD, plays the zone's three lines, then the panel brings it back", async () => {
		const lines = translateCampLines(ZONE_ID, "baked");
		const scene = renderScene({ state: "searching" });
		expect(hudFaded()).toBe(false);

		scene.update({ state: "acampamento", campSource: "baked" });
		expect(hudFaded()).toBe(true);
		expect(
			screen
				.getByRole("button", { name: m.retreat_to_map() })
				.parentElement?.classList.contains("pointer-events-none"),
		).toBe(true);
		expect(screen.getByText(lines[0])).toBeTruthy();

		await advance(CAMP_LINE_2_SHOWN_MS);
		expect(screen.getByText(lines[1])).toBeTruthy();
		await advance(CAMP_LINE_3_SHOWN_MS - CAMP_LINE_2_SHOWN_MS);
		expect(screen.getByText(lines[2])).toBeTruthy();
		expect(screen.queryByText(m.camp_title())).toBeNull();

		await advance(CAMP_PANEL_SHOWN_MS - CAMP_LINE_3_SHOWN_MS);
		expect(screen.getByText(m.camp_title())).toBeTruthy();
		expect(hudFaded()).toBe(false);
	});

	it("skips to the panel on a click anywhere in the scene", async () => {
		const scene = renderScene({ state: "acampamento" });
		fireEvent.click(scene.section());
		await advance(100);
		expect(screen.getByText(m.camp_title())).toBeTruthy();
		expect(hudFaded()).toBe(false);
	});

	it("returns with the loot or presses onward from the panel", () => {
		const scene = renderScene({ state: "acampamento" });
		fireEvent.click(scene.section());

		fireEvent.click(
			screen.getByRole("button", { name: m.camp_return_to_city() }),
		);
		expect(scene.props.onRetreat).toHaveBeenCalledTimes(1);
		fireEvent.click(
			screen.getByRole("button", { name: m.camp_press_onward() }),
		);
		expect(scene.props.onDismissCamp).toHaveBeenCalledTimes(1);
	});

	it("plays the incense lines for an incense camp", () => {
		renderScene({ state: "acampamento", campSource: "incense" });
		expect(
			screen.getByText(translateCampLines(ZONE_ID, "incense")[0]),
		).toBeTruthy();
	});

	it("replays the lines on the next camp after a skipped one", async () => {
		const lines = translateCampLines(ZONE_ID, "baked");
		const scene = renderScene({ state: "acampamento" });
		fireEvent.click(scene.section());
		expect(screen.getByText(m.camp_title())).toBeTruthy();

		scene.update({ state: "searching" });
		await advance(SETTLE_MS);
		scene.update({ state: "acampamento" });
		expect(screen.getByText(lines[0])).toBeTruthy();
		expect(screen.queryByText(m.camp_title())).toBeNull();
		expect(hudFaded()).toBe(true);
	});
});

describe("CombatScene — consumables", () => {
	const CONSUMABLES = [
		{
			key: "potion",
			name: "Use potion",
			count: "potions",
			can: "canUsePotion",
			use: "onUsePotion",
		},
		{
			key: "teleport",
			name: "Use teleport stone",
			count: "teleportStones",
			can: "canUseTeleportStone",
			use: "onUseTeleportStone",
		},
		{
			key: "incense",
			name: m.incense_use_aria(),
			count: "incense",
			can: "canUseIncense",
			use: "onUseIncense",
		},
	] as const;

	it.each(CONSUMABLES)("$key shows its count and fires on click", (c) => {
		const scene = renderScene({ [c.count]: 5 });
		const button = screen.getByRole("button", { name: c.name });
		expect(button.textContent).toBe("5");
		fireEvent.click(button);
		expect(scene.props[c.use]).toHaveBeenCalledTimes(1);
	});

	it.each(CONSUMABLES)("$key is disabled when it can't be used", (c) => {
		const scene = renderScene({ [c.can]: false });
		const button = narrow(
			screen.getByRole("button", { name: c.name }),
			HTMLButtonElement,
		);
		expect(button.disabled).toBe(true);
		fireEvent.click(button);
		expect(scene.props[c.use]).not.toHaveBeenCalled();
	});

	it.each(CONSUMABLES)("$key reports hover and focus to the text log", (c) => {
		const scene = renderScene();
		const button = screen.getByRole("button", { name: c.name });
		const hover = scene.props.onConsumableHover;
		fireEvent.mouseEnter(button);
		expect(hover).toHaveBeenLastCalledWith(c.key);
		fireEvent.mouseLeave(button);
		expect(hover).toHaveBeenLastCalledWith(null);
		fireEvent.focus(button);
		expect(hover).toHaveBeenLastCalledWith(c.key);
		fireEvent.blur(button);
		expect(hover).toHaveBeenLastCalledWith(null);
	});
});

describe("CombatScene — mage element selector", () => {
	const ELEMENT_NAME = {
		flame: m.element_fire(),
		snowflake: m.element_cold(),
		zap: m.element_lightning(),
	};
	function elementButton(icon: keyof typeof ELEMENT_NAME) {
		return narrow(
			screen.getByRole("button", { name: ELEMENT_NAME[icon] }),
			HTMLButtonElement,
		);
	}
	const mage = (overrides: Partial<Props> = {}) =>
		renderScene({
			classId: "mage",
			selectedElement: "fire",
			onSwitchElement: vi.fn<SwitchElement>(),
			...overrides,
		});

	it("only renders for a mage with an element and a switch handler", () => {
		renderScene({
			classId: "warrior",
			selectedElement: "fire",
			onSwitchElement: vi.fn<SwitchElement>(),
		});
		expect(
			screen.queryByRole("button", { name: ELEMENT_NAME.flame }),
		).toBeNull();
	});

	it("switches to another element and reports the hover", () => {
		const scene = mage();
		fireEvent.click(elementButton("snowflake"));
		expect(scene.props.onSwitchElement).toHaveBeenCalledWith("cold");
		fireEvent.click(elementButton("flame"));
		expect(scene.props.onSwitchElement).not.toHaveBeenCalledWith("fire");

		fireEvent.mouseEnter(elementButton("zap"));
		expect(scene.props.onConsumableHover).toHaveBeenLastCalledWith(
			"element_lightning",
		);
		fireEvent.mouseLeave(elementButton("zap"));
		expect(scene.props.onConsumableHover).toHaveBeenLastCalledWith(null);
	});

	it("locks the inactive elements during the switch cooldown", async () => {
		mage({ lastElementSwitchAt: Date.now() });
		expect(elementButton("flame").disabled).toBe(false);
		expect(elementButton("snowflake").disabled).toBe(true);
		expect(elementButton("zap").disabled).toBe(true);

		// The selector polls on an interval, no chained commits: one slice.
		await advance(
			ELEMENT_SWITCH_COOLDOWN_MS + 200,
			ELEMENT_SWITCH_COOLDOWN_MS + 200,
		);
		expect(elementButton("snowflake").disabled).toBe(false);
		expect(elementButton("zap").disabled).toBe(false);
	});
});
