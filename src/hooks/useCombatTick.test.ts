// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeEnemy, makeStats } from "./combat-test-fixtures";
import { useBarrier } from "./useBarrier";
import { useCombatTick } from "./useCombatTick";

type TickParams = Parameters<typeof useCombatTick>[0];
type CombatTickDeps = NonNullable<TickParams["deps"]>;

const rollPlayerSwingMock = vi.fn<CombatTickDeps["rollPlayerSwing"]>();
const rollEnemyAttackMock = vi.fn<CombatTickDeps["rollEnemyAttack"]>();
const TEST_DEPS: CombatTickDeps = {
	rollPlayerSwing: rollPlayerSwingMock,
	rollEnemyAttack: rollEnemyAttackMock,
	playSfx: () => {},
	playPlayerSwingSfx: () => {},
};

const NO_SERVER = {
	syncVitals: async () => {},
	consumePotion: async () => {},
};

describe("useCombatTick — same-tick player swing + thorns reflect", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		rollPlayerSwingMock.mockReset();
		rollEnemyAttackMock.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("composes thorns reflect on top of the player swing instead of overwriting it", () => {
		const PLAYER_DAMAGE = 30;
		const THORNS = 7;
		const INITIAL_HP = 100;

		rollPlayerSwingMock.mockReturnValue({
			amount: PLAYER_DAMAGE,
			isCrit: false,
			isMiss: false,
			isBlocked: false,
			breakdown: {
				physical: PLAYER_DAMAGE,
				cold: 0,
				fire: 0,
				lightning: 0,
				void: 0,
			},
		});
		rollEnemyAttackMock.mockReturnValue({
			amount: 0,
			isCrit: false,
			isMiss: false,
			isBlocked: true,
			breakdown: { physical: 0, cold: 0, fire: 0, lightning: 0, void: 0 },
		});

		let latestEnemy = makeEnemy(INITIAL_HP);
		const updateEnemy = vi.fn<TickParams["updateEnemy"]>((next) => {
			latestEnemy = next;
		});
		const resolveKill = vi.fn<TickParams["resolveKill"]>();
		const onPlayerDeath = vi.fn<TickParams["onPlayerDeath"]>();
		const pushEvent = vi.fn<TickParams["pushEvent"]>();

		renderHook(() => {
			const stats = makeStats({ thorns: THORNS });
			const barrierApi = useBarrier({
				maxBarrier: stats.maxBarrier,
				active: true,
			});
			return useCombatTick({
				...NO_SERVER,
				active: true,
				isEngaged: true,
				enemy: latestEnemy,
				stats,
				initialHp: 100,
				potions: 0,
				barrierApi,
				onPlayerDeath,
				resolveKill,
				pushEvent,
				updateEnemy,
				deps: TEST_DEPS,
			});
		});

		act(() => {
			vi.advanceTimersByTime(50);
		});

		expect(latestEnemy.currentHp).toBe(INITIAL_HP - PLAYER_DAMAGE - THORNS);

		expect(updateEnemy).toHaveBeenCalledTimes(2);
		expect(updateEnemy.mock.calls[0][0].currentHp).toBe(
			INITIAL_HP - PLAYER_DAMAGE,
		);
		expect(updateEnemy.mock.calls[1][0].currentHp).toBe(
			INITIAL_HP - PLAYER_DAMAGE - THORNS,
		);
	});
});

function renderRegenHook({
	lifeRegen,
	maxLife,
	initialHp,
}: {
	lifeRegen: number;
	maxLife: number;
	initialHp: number;
}) {
	return renderHook(() => {
		const stats = makeStats({ lifeRegen, maxLife });
		const barrierApi = useBarrier({
			maxBarrier: stats.maxBarrier,
			active: true,
		});
		return useCombatTick({
			...NO_SERVER,
			active: true,
			isEngaged: false,
			enemy: null,
			stats,
			initialHp,
			potions: 0,
			barrierApi,
			onPlayerDeath: vi.fn<TickParams["onPlayerDeath"]>(),
			resolveKill: vi.fn<TickParams["resolveKill"]>(),
			pushEvent: vi.fn<TickParams["pushEvent"]>(),
			updateEnemy: vi.fn<TickParams["updateEnemy"]>(),
			deps: TEST_DEPS,
		});
	});
}

describe("useCombatTick — life regen modifier", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		rollPlayerSwingMock.mockReset();
		rollEnemyAttackMock.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("applies stats.lifeRegen as continuous HP recovery (out-of-engagement)", () => {
		const { result } = renderRegenHook({
			lifeRegen: 10,
			maxLife: 100,
			initialHp: 50,
		});
		expect(result.current.playerHp).toBe(50);
		act(() => {
			vi.advanceTimersByTime(1000);
		});
		expect(result.current.playerHp).toBe(60);
	});

	it("caps at maxLife and resets the fractional accumulator on overfill", () => {
		const { result } = renderRegenHook({
			lifeRegen: 5,
			maxLife: 100,
			initialHp: 98,
		});
		act(() => {
			vi.advanceTimersByTime(2000);
		});
		expect(result.current.playerHp).toBe(100);
	});

	it("does not regen at fractional rates below 1 HP/s until the accumulator carries", () => {
		const { result } = renderRegenHook({
			lifeRegen: 0.5,
			maxLife: 100,
			initialHp: 50,
		});
		act(() => {
			vi.advanceTimersByTime(1000);
		});
		expect(result.current.playerHp).toBe(50);
		act(() => {
			vi.advanceTimersByTime(1100);
		});
		expect(result.current.playerHp).toBe(51);
	});
});
