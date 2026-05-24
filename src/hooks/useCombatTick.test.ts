// @vitest-environment jsdom

// Regression test for the same-tick collision between a player swing and an
// enemy swing when the player has thorns: the thorns block used to read enemy
// HP from a top-of-tick snapshot rather than the live `enemyRef`, so it wrote
// `(preSwingHp - thorns)` back over the post-player-swing HP and silently
// erased the player-swing damage. The fix reads `enemyRef.current` at the
// reflect site; this test exercises that path through the real hook so a
// future refactor that re-introduces the snapshot read fails loudly.

import { act, renderHook } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Enemy } from "#/game/combat/types";
import type { MonsterDefinition } from "#/game/monsters/types";
import type { ComputedCharacterStats, SwingProfile } from "#/game/stats/types";
import { SessionTokenProvider } from "./useSessionToken";

// ── Mocks ──────────────────────────────────────────────────────────────────
// `useCombatTick` calls `useMutation(api.combat.syncHp)` and `.usePotion`.
// In tests there's no Convex client; stub the hook out with a no-op callable
// that still exposes `.withOptimisticUpdate` (used for the potion mutation).
vi.mock("convex/react", () => {
	const noop = Object.assign(
		async () => {
			/* no-op */
		},
		{ withOptimisticUpdate: () => noop },
	);
	return { useMutation: () => noop };
});

// Stub SFX — jsdom has no real audio backend and we don't need the side effect.
vi.mock("#/lib/sfx", () => ({ playSfx: () => {} }));

// Stub the damage roll functions so we control exactly how much each side
// deals — the bug under test is in HOW the hook composes those results, not
// in the dice rolls themselves.
const rollPlayerSwingMock = vi.fn();
const rollEnemyAttackMock = vi.fn();
vi.mock("#/game/combat/damage", async () => {
	const actual = await vi.importActual<typeof import("#/game/combat/damage")>(
		"#/game/combat/damage",
	);
	return {
		...actual,
		rollPlayerSwing: (...args: unknown[]) => rollPlayerSwingMock(...args),
		rollEnemyAttack: (...args: unknown[]) => rollEnemyAttackMock(...args),
	};
});

// Imported AFTER mocks so the hook closure picks up the mocked deps.
const { useCombatTick } = await import("./useCombatTick");

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeStats(
	overrides: Partial<ComputedCharacterStats> = {},
): ComputedCharacterStats {
	const swing: SwingProfile = {
		source: "mainHand",
		itemId: "test-weapon",
		weaponType: "sword",
		physicalDamage: { min: 10, max: 10 },
		elementalDamage: [],
		baseCritChance: 0,
		baseAttackSpeed: 1,
	};
	return {
		attributes: { strength: 10, dexterity: 10, intelligence: 10 },
		maxLife: 100,
		lifeRegen: 0,
		maxMana: 0,
		manaRegen: 0,
		maxBarrier: 0,
		armor: 0,
		evasion: 0,
		accuracy: 1000,
		blockChance: 0,
		thorns: 0,
		resistances: { cold: 0, fire: 0, lightning: 0, void: 0 },
		path: "attack",
		// 20 swings/sec × 50ms tick = exactly 1.0 progress per tick, so both
		// player + enemy swings fire on the first tick after activation.
		tickRate: 20,
		swings: [swing],
		increased: {
			physical: 0,
			cold: 0,
			fire: 0,
			lightning: 0,
			void: 0,
			elementalGlobal: 0,
			elementalWithAttacks: 0,
			melee: 0,
			spell: 0,
			attackSpeed: 0,
			castSpeed: 0,
			criticalChance: 0,
		},
		bonusCritMultiplier: 0,
		movementSpeed: 0,
		lifeGainOnHit: 0,
		manaGainOnHit: 0,
		lifeOnKill: 0,
		manaOnKill: 0,
		lifeLeechPercent: 0,
		magicFind: 0,
		gainAsExtraSpell: { cold: 0, fire: 0, lightning: 0, void: 0 },
		brokenItemIds: new Set<string>(),
		...overrides,
	};
}

function makeEnemy(currentHp: number): Enemy {
	const def: MonsterDefinition = {
		id: "test-mob",
		name: "Test Mob",
		sprite: "x",
		baseStats: {
			hp: currentHp,
			attackSpeed: 20, // matches tickRate so enemy swing fires on tick 1
			physicalDamage: { min: 5, max: 5 },
			elementalDamage: [],
		},
		xpReward: 1,
		allowedRarities: ["normal"],
	};
	return {
		def,
		currentHp,
		level: 1,
		rarity: "normal",
		mods: [],
		// Fresh `scaled` object per spawn (per the file's invariant comment).
		scaled: {
			level: 1,
			hp: currentHp,
			physicalDamage: { min: 5, max: 5 },
			elementalDamage: [],
			attackSpeed: 20,
			xpReward: 1,
			armor: 0,
			evasion: 0,
			accuracy: 1000,
			resistances: { cold: 0, fire: 0, lightning: 0, void: 0 },
		},
		nameSeed: { primary: 0, secondary: 0, epithet: 0 },
	};
}

// ── Test ───────────────────────────────────────────────────────────────────

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
			// Enemy lands a hit (so thorns reflect triggers), zero damage so the
			// player's HP doesn't decay and complicate the assertion.
			amount: 0,
			isCrit: false,
			isMiss: false,
			isBlocked: true,
			breakdown: { physical: 0, cold: 0, fire: 0, lightning: 0, void: 0 },
		});

		let latestEnemy = makeEnemy(INITIAL_HP);
		const updateEnemy = vi.fn((next: Enemy) => {
			latestEnemy = next;
		});
		const resolveKill = vi.fn();
		const onPlayerDeath = vi.fn();
		const pushEvent = vi.fn();

		renderHook(
			() =>
				useCombatTick({
					characterId: "test-char" as unknown as Parameters<
						typeof useCombatTick
					>[0]["characterId"],
					active: true,
					isEngaged: true,
					enemy: latestEnemy,
					stats: makeStats({ thorns: THORNS }),
					initialHp: 100,
					potions: 0,
					onPlayerDeath,
					resolveKill,
					pushEvent,
					updateEnemy,
				}),
			{
				wrapper: ({ children }) =>
					createElement(SessionTokenProvider, null, children),
			},
		);

		// One 50ms tick → both progress refs reach exactly 1.0 → both swings
		// fire in the same callback invocation.
		act(() => {
			vi.advanceTimersByTime(50);
		});

		// The bug: thorns block would read the top-of-tick snapshot HP (100) and
		// write back `100 - 7 = 93`, overwriting the player-swing HP (70).
		// The fix: read the live ref so thorns lands at `70 - 7 = 63`.
		expect(latestEnemy.currentHp).toBe(INITIAL_HP - PLAYER_DAMAGE - THORNS);

		// Both swings should have invoked updateEnemy (player swing first, then
		// the thorns reflect) — that ordering is what made the bug latent.
		expect(updateEnemy).toHaveBeenCalledTimes(2);
		expect(updateEnemy.mock.calls[0][0].currentHp).toBe(
			INITIAL_HP - PLAYER_DAMAGE,
		);
		expect(updateEnemy.mock.calls[1][0].currentHp).toBe(
			INITIAL_HP - PLAYER_DAMAGE - THORNS,
		);
	});
});
