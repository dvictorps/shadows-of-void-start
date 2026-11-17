import { describe, expect, it } from "vitest";

import { xpToNextLevel } from "#/game/progression/levels";

import { type VitalsInput, statusVitals } from "./vitals";

function input(overrides: Partial<VitalsInput> = {}): VitalsInput {
	return {
		character: {
			hpCurrent: 60,
			potions: 2,
			xp: 10,
			level: 1,
			currentLocation: "zone_1",
		},
		stats: { maxLife: 100, maxBarrier: 40 },
		teleportStones: 1,
		hasPotionHandler: true,
		hasTeleportHandler: true,
		...overrides,
	};
}

describe("statusVitals", () => {
	it("reads the character row without overrides; the barrier reads full", () => {
		const v = statusVitals(input());
		expect(v).toMatchObject({
			hp: 60,
			maxHp: 100,
			barrier: 40,
			maxBarrier: 40,
			potions: 2,
			xp: 10,
			xpNeeded: xpToNextLevel(1),
		});
	});

	it("prefers every override over the row", () => {
		const v = statusVitals(
			input({
				hpOverride: 5,
				barrierOverride: 3,
				potionsOverride: 9,
				xpOverride: 20,
			}),
		);
		expect(v).toMatchObject({ hp: 5, barrier: 3, potions: 9, xp: 20 });
	});

	it("allows a potion only with a handler, a potion and missing life", () => {
		expect(statusVitals(input()).canUsePotion).toBe(true);
		expect(statusVitals(input({ hasPotionHandler: false })).canUsePotion).toBe(
			false,
		);
		expect(statusVitals(input({ potionsOverride: 0 })).canUsePotion).toBe(
			false,
		);
		expect(statusVitals(input({ hpOverride: 100 })).canUsePotion).toBe(false);
	});

	it("allows a teleport only with a handler, a stone and outside the city", () => {
		expect(statusVitals(input()).canUseTeleportStone).toBe(true);
		expect(
			statusVitals(input({ hasTeleportHandler: false })).canUseTeleportStone,
		).toBe(false);
		expect(statusVitals(input({ teleportStones: 0 })).canUseTeleportStone).toBe(
			false,
		);
		const inCity = input();
		inCity.character = { ...inCity.character, currentLocation: "city" };
		expect(statusVitals(inCity).canUseTeleportStone).toBe(false);
	});
});
