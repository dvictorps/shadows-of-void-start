// @vitest-environment jsdom

// The combat state machine end to end: spawn → engaged → victory → next
// spawn, the rare and boss intro cascades, camps, incense, the boss-node
// gauntlet, and the activation reset. Runs the real hook (and through it the
// real tick and encounter schedule) on fake timers.
//
// - The server is a parameter (`server`), so the calls are fakes, not module
//   mocks.
// - `Math.random` is pinned to 0.5: spawns roll "normal", gaps sit at the
//   middle of their range, and every swing lands.
// - The character one-shots anything and can't die, so a fight is exactly one
//   tick. These tests are about the transitions, not the damage math (that's
//   `src/game/combat` and useCombatTick.test.ts).

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	BOSS_INTRO_STAGE_MS_DEFAULT,
	RARE_INTRO_STAGE_MS,
} from "#/game/combat/types";
import type { MonsterId } from "#/game/monsters";
import type { BossNodeConfig } from "#/game/world";
import type { ZoneEncounterPlan } from "#/game/world/encounter-schedule";
import { setGlobalSfxVolume } from "#/lib/sfx";

import { makeStats } from "./combat-test-fixtures";
import { useBarrier } from "./useBarrier";
import { type CombatServer, useCombatLoop } from "./useCombatLoop";

type LoopParams = Parameters<typeof useCombatLoop>[0];
type Props = Omit<LoopParams, "barrierApi">;

const STEP_MS = 50;
const SPAWN_GAP_MS = 1000;
const VICTORY_DELAY_MS = 800;
const GAUNTLET_SPAWN_MS = 600;
const RARE_INTRO_MS =
	RARE_INTRO_STAGE_MS.sprite +
	RARE_INTRO_STAGE_MS.name +
	RARE_INTRO_STAGE_MS.hp;
const BOSS_INTRO_MS = Object.values(BOSS_INTRO_STAGE_MS_DEFAULT).reduce(
	(sum, ms) => sum + ms,
);
const MAX_LIFE = 1_000_000;
const POOL: readonly MonsterId[] = ["goblin"];

const PLAN: ZoneEncounterPlan = {
	calmariaBudgetSeconds: 30,
	gapBetweenSpawns: { min: 1, max: 1 },
	campFractions: [],
};

// The miniboss arrives on the first spawn: the bar (0.5 s) fills before the
// first gap (1 s) ends.
const SHORT_BUDGET_PLAN: ZoneEncounterPlan = {
	...PLAN,
	calmariaBudgetSeconds: 0.5,
};

const BOSS_NODE: BossNodeConfig = {
	bossId: "gralfor",
	gauntlet: { fights: 1, monsterPool: ["goblin"] },
};

function oneShotStats() {
	const base = makeStats({ maxLife: MAX_LIFE });
	return {
		...base,
		swings: base.swings.map((swing) => ({
			...swing,
			physicalDamage: { min: 10_000_000, max: 10_000_000 },
		})),
	};
}

function makeServer() {
	return {
		recordKill: vi
			.fn<CombatServer["recordKill"]>()
			.mockResolvedValue({ potionDropped: false }),
		syncHp: vi.fn<CombatServer["syncHp"]>().mockResolvedValue({}),
		consumePotion: vi.fn<CombatServer["consumePotion"]>().mockResolvedValue({}),
		consumeIncense: vi
			.fn<CombatServer["consumeIncense"]>()
			.mockResolvedValue({}),
		enterCamp: vi.fn<CombatServer["enterCamp"]>().mockResolvedValue({}),
		enterCampViaIncense: vi
			.fn<CombatServer["enterCampViaIncense"]>()
			.mockResolvedValue({}),
		exitCamp: vi.fn<CombatServer["exitCamp"]>().mockResolvedValue({}),
	};
}

function useHarness(props: Props) {
	const barrierApi = useBarrier({
		maxBarrier: props.stats.maxBarrier,
		active: props.active,
	});
	return useCombatLoop({ ...props, barrierApi });
}

function setup(overrides: Partial<Props> = {}) {
	const server = makeServer();
	const onPlayerDeath = vi.fn<Props["onPlayerDeath"]>();
	const props: Props = {
		characterId: 7,
		server,
		stats: oneShotStats(),
		initialHp: MAX_LIFE,
		potions: 0,
		incense: 1,
		monsterPool: POOL,
		zoneLevel: 1,
		encounterPlan: PLAN,
		bossNode: null,
		serverCampThresholdsMs: [],
		active: true,
		onPlayerDeath,
		...overrides,
	};
	// Mounted inactive, then activated, as in the app: `/world` opens on the
	// map and entering a zone flips `active`.
	const hook = renderHook((p: Props) => useHarness(p), {
		initialProps: { ...props, active: false },
	});
	hook.rerender(props);
	return { ...hook, props, server, onPlayerDeath };
}

// One `act` per step: React flushes effects (and arms the next timers) at the
// end of each act, so a single long advance would skip the timers a state
// change schedules.
function advance(ms: number) {
	for (let elapsed = 0; elapsed < ms; elapsed += STEP_MS) {
		act(() => {
			vi.advanceTimersByTime(STEP_MS);
		});
	}
}

// Settles the fire-and-forget `recordKill` promise.
async function flushServer() {
	await act(async () => {});
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.spyOn(Math, "random").mockReturnValue(0.5);
	setGlobalSfxVolume(0);
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("useCombatLoop — regular fight cycle", () => {
	it("searches, spawns after the gap, and engages a normal mob", () => {
		const { result } = setup();
		expect(result.current.state).toBe("searching");
		expect(result.current.phase).toBe("exploration");

		advance(SPAWN_GAP_MS - STEP_MS);
		expect(result.current.enemy).toBeNull();

		advance(STEP_MS);
		expect(result.current.state).toBe("engaged");
		expect(result.current.phase).toBe("combat");
		expect(result.current.enemy?.def.id).toBe("goblin");
		expect(result.current.enemy?.rarity).toBe("normal");
	});

	it("records the kill with the server and goes back to searching after the victory pause", async () => {
		const { result, server } = setup();
		advance(SPAWN_GAP_MS + STEP_MS);
		expect(result.current.state).toBe("victory");
		const killed = result.current.enemy;
		expect(result.current.lastKill).toEqual({
			xp: killed?.scaled.xpReward,
			potion: false,
		});
		// The kill carries the vitals, so it doubles as the HP sync.
		expect(server.recordKill).toHaveBeenCalledExactlyOnceWith({
			characterId: 7,
			monsterId: "goblin",
			monsterLevel: killed?.level,
			monsterRarity: "normal",
			clientHp: result.current.playerHp,
			clientBarrier: 0,
		});

		await flushServer();
		advance(VICTORY_DELAY_MS);
		expect(result.current.state).toBe("searching");
		expect(result.current.enemy).toBeNull();
		expect(result.current.lastKill).toBeNull();
	});

	it("applies the server's new max life on a level-up kill", async () => {
		const { result, server } = setup();
		server.recordKill.mockResolvedValue({
			potionDropped: true,
			newMaxLife: 1_234_567,
			newMaxBarrier: 0,
		});
		advance(SPAWN_GAP_MS + STEP_MS);
		await flushServer();
		expect(result.current.playerHp).toBe(1_234_567);
		expect(result.current.lastKill?.potion).toBe(true);
	});

	it("keeps going when the kill record fails", async () => {
		const { result, server } = setup();
		server.recordKill.mockRejectedValue(new Error("network"));
		advance(SPAWN_GAP_MS + STEP_MS);
		await flushServer();
		advance(VICTORY_DELAY_MS);
		expect(result.current.state).toBe("searching");
	});
});

describe("useCombatLoop — zone miniboss", () => {
	it("spawns a rare when the bar is full and cascades its intro into the fight", () => {
		const { result } = setup({ encounterPlan: SHORT_BUDGET_PLAN });
		advance(SPAWN_GAP_MS);
		expect(result.current.state).toBe("rare_intro");
		expect(result.current.rareIntroStage).toBe("sprite");
		expect(result.current.enemy?.rarity).toBe("rare");

		advance(RARE_INTRO_STAGE_MS.sprite);
		expect(result.current.rareIntroStage).toBe("name");
		advance(RARE_INTRO_STAGE_MS.name);
		expect(result.current.rareIntroStage).toBe("hp");
		advance(RARE_INTRO_STAGE_MS.hp);
		expect(result.current.state).toBe("engaged");
		expect(result.current.rareIntroStage).toBeNull();
	});

	it("pauses on the miniboss panel after the kill, and resumes on dismiss", async () => {
		const { result, server } = setup({ encounterPlan: SHORT_BUDGET_PLAN });
		advance(SPAWN_GAP_MS + RARE_INTRO_MS + STEP_MS);
		expect(result.current.state).toBe("victory");
		expect(server.recordKill).toHaveBeenCalledWith(
			expect.objectContaining({ monsterRarity: "rare" }),
		);
		// The kill reset the time bar for the next stretch.
		expect(result.current.calmariaElapsedMs).toBe(0);

		await flushServer();
		advance(VICTORY_DELAY_MS);
		expect(result.current.state).toBe("miniboss_victory");

		act(() => result.current.dismissMinibossModal());
		expect(result.current.state).toBe("searching");
		expect(server.exitCamp).toHaveBeenCalledExactlyOnceWith({ characterId: 7 });
	});
});

describe("useCombatLoop — camps", () => {
	it("enters camp when the bar crosses a server threshold, and leaves on dismiss", () => {
		const { result, server } = setup({ serverCampThresholdsMs: [300] });
		advance(300);
		expect(result.current.state).toBe("acampamento");
		expect(result.current.campSource).toBe("baked");
		expect(server.enterCamp).toHaveBeenCalledExactlyOnceWith({
			characterId: 7,
			thresholdIndex: 0,
		});

		// No spawn while camped.
		advance(SPAWN_GAP_MS * 2);
		expect(result.current.enemy).toBeNull();

		act(() => result.current.dismissCamp());
		expect(result.current.state).toBe("searching");
		expect(server.exitCamp).toHaveBeenCalledExactlyOnceWith({ characterId: 7 });
	});

	it("ignores dismissCamp outside a camp", () => {
		const { result, server } = setup();
		act(() => result.current.dismissCamp());
		expect(result.current.state).toBe("searching");
		expect(server.exitCamp).not.toHaveBeenCalled();
	});
});

describe("useCombatLoop — Incenso Etéreo", () => {
	it("camps at once while searching", () => {
		const { result, server } = setup();
		act(() => result.current.triggerIncense());
		expect(result.current.state).toBe("acampamento");
		expect(result.current.campSource).toBe("incense");
		expect(server.consumeIncense).toHaveBeenCalledExactlyOnceWith({
			characterId: 7,
		});
		expect(server.enterCampViaIncense).toHaveBeenCalledExactlyOnceWith({
			characterId: 7,
		});
	});

	it("queues during a normal fight and camps after the victory pause", async () => {
		const { result, server } = setup();
		advance(SPAWN_GAP_MS);
		expect(result.current.state).toBe("engaged");

		act(() => result.current.triggerIncense());
		expect(result.current.state).toBe("engaged");
		expect(server.consumeIncense).toHaveBeenCalledOnce();
		expect(server.enterCampViaIncense).not.toHaveBeenCalled();

		advance(STEP_MS);
		await flushServer();
		advance(VICTORY_DELAY_MS);
		expect(result.current.state).toBe("acampamento");
		expect(result.current.campSource).toBe("incense");
		expect(server.enterCampViaIncense).toHaveBeenCalledOnce();
	});

	it("does nothing without incense", () => {
		const { result, server } = setup({ incense: 0 });
		act(() => result.current.triggerIncense());
		expect(result.current.state).toBe("searching");
		expect(server.consumeIncense).not.toHaveBeenCalled();
	});

	it("is blocked during a rare intro", () => {
		const { result, server } = setup({ encounterPlan: SHORT_BUDGET_PLAN });
		advance(SPAWN_GAP_MS);
		expect(result.current.state).toBe("rare_intro");
		act(() => result.current.triggerIncense());
		expect(result.current.state).toBe("rare_intro");
		expect(server.consumeIncense).not.toHaveBeenCalled();
	});

	it("is blocked during the rare fight itself", () => {
		const { result, server } = setup({
			encounterPlan: SHORT_BUDGET_PLAN,
			// Nothing dies, so the fight stays on.
			stats: makeStats({ maxLife: MAX_LIFE }),
		});
		advance(SPAWN_GAP_MS + RARE_INTRO_MS);
		expect(result.current.state).toBe("engaged");
		act(() => result.current.triggerIncense());
		expect(server.consumeIncense).not.toHaveBeenCalled();
	});
});

describe("useCombatLoop — boss node", () => {
	it("runs the gauntlet, then the boss intro, then the boss fight", async () => {
		const { result } = setup({ bossNode: BOSS_NODE });
		advance(GAUNTLET_SPAWN_MS);
		expect(result.current.state).toBe("rare_intro");
		expect(result.current.enemy?.rarity).toBe("rare");

		advance(RARE_INTRO_MS + STEP_MS);
		expect(result.current.state).toBe("victory");
		await flushServer();
		// A gauntlet rare advances the gauntlet: no miniboss panel.
		advance(VICTORY_DELAY_MS);
		expect(result.current.state).toBe("searching");

		advance(GAUNTLET_SPAWN_MS);
		expect(result.current.state).toBe("boss_intro");
		expect(result.current.bossIntroStage).toBe("sprite");
		expect(result.current.enemy?.rarity).toBe("unique");

		advance(BOSS_INTRO_MS);
		expect(result.current.state).toBe("engaged");
		expect(result.current.bossIntroStage).toBeNull();
	});

	it("spawns regular mobs during the warmup and no gauntlet until the bar fills", () => {
		const { result } = setup({
			bossNode: { ...BOSS_NODE, warmupSeconds: 30 },
		});
		advance(SPAWN_GAP_MS);
		expect(result.current.state).toBe("engaged");
		expect(result.current.enemy?.rarity).toBe("normal");
	});
});

describe("useCombatLoop — activation reset", () => {
	it("leaving and re-entering mid-fight starts clean", () => {
		const { result, rerender, props } = setup({
			stats: makeStats({ maxLife: MAX_LIFE }),
		});
		advance(SPAWN_GAP_MS);
		expect(result.current.state).toBe("engaged");

		rerender({ ...props, active: false });
		rerender({ ...props, active: true });
		expect(result.current.state).toBe("searching");
		expect(result.current.enemy).toBeNull();
		expect(result.current.lastKill).toBeNull();
		expect(result.current.calmariaElapsedMs).toBe(0);
	});

	it("drops a queued incense on re-entry", async () => {
		const { result, rerender, props, server } = setup({
			stats: makeStats({ maxLife: MAX_LIFE }),
		});
		advance(SPAWN_GAP_MS);
		act(() => result.current.triggerIncense());

		rerender({ ...props, active: false });
		rerender({ ...props, active: true, stats: oneShotStats() });
		advance(SPAWN_GAP_MS + STEP_MS);
		await flushServer();
		advance(VICTORY_DELAY_MS);
		expect(result.current.state).toBe("searching");
		expect(server.enterCampViaIncense).not.toHaveBeenCalled();
	});

	it("rewinds the boss-node gauntlet to fight 1", async () => {
		const { result, rerender, props } = setup({
			bossNode: {
				...BOSS_NODE,
				gauntlet: { ...BOSS_NODE.gauntlet, fights: 2 },
			},
		});
		// Clear gauntlet fight 1 of 2.
		advance(GAUNTLET_SPAWN_MS + RARE_INTRO_MS + STEP_MS);
		await flushServer();
		advance(VICTORY_DELAY_MS);

		rerender({ ...props, active: false });
		rerender({ ...props, active: true });
		// Two rares again before the boss, not one.
		for (let fight = 0; fight < 2; fight++) {
			advance(GAUNTLET_SPAWN_MS);
			expect(result.current.enemy?.rarity).toBe("rare");
			advance(RARE_INTRO_MS + STEP_MS);
			await flushServer();
			advance(VICTORY_DELAY_MS);
		}
		advance(GAUNTLET_SPAWN_MS);
		expect(result.current.enemy?.rarity).toBe("unique");
	});
});
