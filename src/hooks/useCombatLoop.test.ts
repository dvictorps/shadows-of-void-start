// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BOSSES, bossIntroStageMs, GRALFOR } from "#/game/bosses";
import { RARE_INTRO_STAGE_MS } from "#/game/combat/types";
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
const introMs = (cinematic: typeof GRALFOR.cinematic) =>
	Object.values(bossIntroStageMs(cinematic)).reduce((sum, ms) => sum + ms);
const BOSS_INTRO_MS = introMs(GRALFOR.cinematic);
const MAX_LIFE = 1_000_000;
const POOL: readonly MonsterId[] = ["goblin"];

const PLAN: ZoneEncounterPlan = {
	calmariaBudgetSeconds: 30,
	gapBetweenSpawns: { min: 1, max: 1 },
	campFractions: [],
};

const SHORT_BUDGET_PLAN: ZoneEncounterPlan = {
	...PLAN,
	calmariaBudgetSeconds: 0.5,
};
const EXIT_MS = 500;

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
		serverBudgetMs: null,
		serverCampThresholdsMs: [],
		active: true,
		onPlayerDeath,
		...overrides,
	};
	const hook = renderHook((p: Props) => useHarness(p), {
		initialProps: { ...props, active: false },
	});
	const enterZone = (next: Props = props) => {
		act(() => hook.result.current.startVisit(next.bossNode ?? null));
		hook.rerender({ ...next, active: true });
	};
	const leaveZone = (next: Props = props) => {
		hook.rerender({ ...next, active: false });
	};
	enterZone();
	return { ...hook, props, server, onPlayerDeath, enterZone, leaveZone };
}

function advance(ms: number) {
	for (let elapsed = 0; elapsed < ms; elapsed += STEP_MS) {
		act(() => {
			vi.advanceTimersByTime(STEP_MS);
		});
	}
}

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
	it("spawns a rare at the route's exit and cascades its intro into the fight", () => {
		const { result } = setup({ encounterPlan: SHORT_BUDGET_PLAN });
		advance(EXIT_MS);
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
		advance(EXIT_MS + RARE_INTRO_MS + STEP_MS);
		expect(result.current.state).toBe("victory");
		expect(server.recordKill).toHaveBeenCalledWith(
			expect.objectContaining({ monsterRarity: "rare" }),
		);
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
			stats: makeStats({ maxLife: MAX_LIFE }),
		});
		advance(EXIT_MS + RARE_INTRO_MS);
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

	it("restarts the gauntlet after a boss kill, so the boss never respawns alone", async () => {
		const { result, server } = setup({ bossNode: BOSS_NODE });
		advance(GAUNTLET_SPAWN_MS + RARE_INTRO_MS + STEP_MS);
		await flushServer();
		advance(VICTORY_DELAY_MS + GAUNTLET_SPAWN_MS + BOSS_INTRO_MS + STEP_MS);
		expect(server.recordKill).toHaveBeenLastCalledWith(
			expect.objectContaining({ monsterRarity: "unique" }),
		);
		await flushServer();
		advance(VICTORY_DELAY_MS);
		expect(result.current.state).toBe("miniboss_victory");

		act(() => result.current.dismissMinibossModal());
		advance(GAUNTLET_SPAWN_MS);
		expect(result.current.state).toBe("rare_intro");
		expect(result.current.enemy?.rarity).toBe("rare");
	});

	it("holds each intro stage for the boss's own cinematic timings", async () => {
		const slow = {
			...GRALFOR,
			cinematic: {
				...GRALFOR.cinematic,
				spriteFadeInMs: 2000,
				sfxBeatMs: 1500,
			},
		};
		BOSSES.gralfor = slow;
		try {
			const { result } = setup({
				bossNode: {
					...BOSS_NODE,
					gauntlet: { ...BOSS_NODE.gauntlet, fights: 0 },
				},
			});
			advance(GAUNTLET_SPAWN_MS);
			expect(result.current.bossIntroStage).toBe("sprite");
			advance(GRALFOR.cinematic.spriteFadeInMs);
			expect(result.current.bossIntroStage).toBe("sprite");
			advance(2000 - GRALFOR.cinematic.spriteFadeInMs);
			expect(result.current.bossIntroStage).toBe("impact");
			advance(1500);
			expect(result.current.bossIntroStage).toBe("name");
			advance(introMs(slow.cinematic) - 2000 - 1500);
			expect(result.current.state).toBe("engaged");
		} finally {
			BOSSES.gralfor = GRALFOR;
		}
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

describe("useCombatLoop — a new zone visit (startVisit)", () => {
	it("leaving and re-entering mid-fight starts clean", () => {
		const { result, enterZone, leaveZone } = setup({
			stats: makeStats({ maxLife: MAX_LIFE }),
		});
		advance(SPAWN_GAP_MS);
		expect(result.current.state).toBe("engaged");

		leaveZone();
		enterZone();
		expect(result.current.state).toBe("searching");
		expect(result.current.enemy).toBeNull();
		expect(result.current.lastKill).toBeNull();
		expect(result.current.calmariaElapsedMs).toBe(0);
	});

	it("drops a queued incense on re-entry", async () => {
		const { result, props, server, enterZone, leaveZone } = setup({
			stats: makeStats({ maxLife: MAX_LIFE }),
		});
		advance(SPAWN_GAP_MS);
		act(() => result.current.triggerIncense());

		leaveZone();
		enterZone({ ...props, stats: oneShotStats() });
		advance(SPAWN_GAP_MS + STEP_MS);
		await flushServer();
		advance(VICTORY_DELAY_MS);
		expect(result.current.state).toBe("searching");
		expect(server.enterCampViaIncense).not.toHaveBeenCalled();
	});

	it("a miniboss kill left during the victory pause doesn't hold the next visit's bar", async () => {
		const { result, props, enterZone, leaveZone } = setup({
			encounterPlan: SHORT_BUDGET_PLAN,
		});
		advance(SPAWN_GAP_MS + RARE_INTRO_MS + STEP_MS);
		expect(result.current.state).toBe("victory");
		await flushServer();

		leaveZone();
		enterZone({ ...props, encounterPlan: PLAN });
		advance(500);
		expect(result.current.calmariaElapsedMs).toBe(500);
	});

	it("rewinds the boss-node gauntlet to fight 1", async () => {
		const { result, enterZone, leaveZone } = setup({
			bossNode: {
				...BOSS_NODE,
				gauntlet: { ...BOSS_NODE.gauntlet, fights: 2 },
			},
		});
		advance(GAUNTLET_SPAWN_MS + RARE_INTRO_MS + STEP_MS);
		await flushServer();
		advance(VICTORY_DELAY_MS);

		leaveZone();
		enterZone();
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

describe("useCombatLoop — pausing and resuming the same visit", () => {
	it("resumes the fight with the same enemy", () => {
		const { result, rerender, props } = setup({
			stats: makeStats({ maxLife: MAX_LIFE }),
		});
		advance(SPAWN_GAP_MS);
		const enemy = result.current.enemy;
		expect(enemy).not.toBeNull();

		rerender({ ...props, active: false });
		advance(SPAWN_GAP_MS);
		rerender({ ...props, active: true });
		expect(result.current.state).toBe("engaged");
		expect(result.current.enemy).toBe(enemy);
	});

	it("keeps the fight's HP instead of snapping back to the cached value", () => {
		const base = makeStats({ maxLife: MAX_LIFE });
		const { result, rerender, props } = setup({
			stats: {
				...base,
				swings: base.swings.map((swing) => ({
					...swing,
					physicalDamage: { min: 0, max: 0 },
				})),
			},
		});
		advance(SPAWN_GAP_MS + 3000);
		const hurt = result.current.playerHp;
		expect(hurt).toBeLessThan(MAX_LIFE);

		rerender({ ...props, active: false });
		rerender({ ...props, active: true, initialHp: MAX_LIFE });
		expect(result.current.playerHp).toBe(hurt);
	});

	it("keeps the time bar and the gauntlet progress", async () => {
		const { result, rerender, props } = setup({
			bossNode: {
				...BOSS_NODE,
				gauntlet: { ...BOSS_NODE.gauntlet, fights: 2 },
			},
		});
		advance(GAUNTLET_SPAWN_MS + RARE_INTRO_MS + STEP_MS);
		await flushServer();
		advance(VICTORY_DELAY_MS);

		rerender({ ...props, active: false });
		rerender({ ...props, active: true });
		advance(GAUNTLET_SPAWN_MS);
		expect(result.current.enemy?.rarity).toBe("rare");
		advance(RARE_INTRO_MS + STEP_MS);
		await flushServer();
		advance(VICTORY_DELAY_MS + GAUNTLET_SPAWN_MS);
		expect(result.current.enemy?.rarity).toBe("unique");
	});
});
