// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { characterRow } from "#/components/world/character-test-fixtures";
import { CHARACTER_ID, ring } from "#/components/world/item-test-fixtures";
import { POTION_HEAL_FRACTION } from "#/game/combat/constants";
import type { BagEntry } from "#/lib/api-types";

import { renderWithServer } from "./trpc-hook-harness";
import { useCombatMutations } from "./useCombatMutations";

const MAX_HP = 200;

function bagEntry(bagId: string): BagEntry {
	return {
		bagId,
		data: ring(bagId),
		droppedAt: 0,
		droppedFrom: "goblin",
		droppedFromLevel: 1,
	};
}

function setup() {
	const harness = renderWithServer(() =>
		useCombatMutations({ characterId: CHARACTER_ID, maxHp: MAX_HP }),
	);
	const mutations = () => harness.result.current;
	return { ...harness, mutations };
}

const KILL_OUTCOME = {
	xpGained: 5,
	levelsGained: 0,
	potionDropped: false,
	incenseDropped: false,
};

describe("recordKill", () => {
	it("writes the character patch and appends the drops that landed", async () => {
		const h = setup();
		h.seed({ character: characterRow({ xp: 0 }), zoneBag: [bagEntry("a")] });
		h.server.reply("combat.recordKill", {
			...KILL_OUTCOME,
			character: { xp: 5, currentZoneKills: 1 },
			drops: [bagEntry("b")],
		});

		await h.call(() =>
			h.mutations().recordKill({
				characterId: CHARACTER_ID,
				monsterId: "goblin",
				monsterLevel: 1,
				monsterRarity: "normal",
			}),
		);

		expect(h.cache.character()?.xp).toBe(5);
		expect(h.cache.zoneBag()?.map((e) => e.bagId)).toEqual(["a", "b"]);
	});

	it("leaves the bag alone when nothing dropped", async () => {
		const h = setup();
		const bag = [bagEntry("a")];
		h.seed({ character: characterRow(), zoneBag: bag });
		h.server.reply("combat.recordKill", {
			...KILL_OUTCOME,
			character: { xp: 0, currentZoneKills: 1 },
			drops: [],
		});

		await h.call(() =>
			h.mutations().recordKill({
				characterId: CHARACTER_ID,
				monsterId: "goblin",
				monsterLevel: 1,
				monsterRarity: "normal",
			}),
		);

		expect(h.cache.zoneBag()).toBe(bag);
	});
});

describe("syncHp", () => {
	it("writes hp and the barrier clamped to its cached max", async () => {
		const h = setup();
		h.seed({ character: characterRow({ cachedMaxBarrier: 30 }) });
		h.server.reply("combat.syncHp", { hpCurrent: 42 });

		await h.call(() =>
			h.mutations().syncHp({
				characterId: CHARACTER_ID,
				hpCurrent: 42,
				barrierCurrent: 99,
			}),
		);

		expect(h.cache.character()).toMatchObject({
			hpCurrent: 42,
			barrierCurrent: 30,
		});
	});

	it("writes only hp when no barrier was sent", async () => {
		const h = setup();
		h.seed({ character: characterRow({ barrierCurrent: 7 }) });
		h.server.reply("combat.syncHp", { hpCurrent: 10 });

		await h.call(() =>
			h.mutations().syncHp({ characterId: CHARACTER_ID, hpCurrent: 10 }),
		);

		expect(h.cache.character()).toMatchObject({
			hpCurrent: 10,
			barrierCurrent: 7,
		});
	});
});

describe("consumePotion", () => {
	it("drinks before the server answers, then writes the server's numbers", async () => {
		const h = setup();
		h.seed({ character: characterRow({ hpCurrent: 150, potions: 2 }) });

		const call = await h.start("combat.consumePotion", () =>
			h.mutations().consumePotion({ characterId: CHARACTER_ID, clientHp: 50 }),
		);
		expect(h.cache.character()).toMatchObject({
			potions: 1,
			hpCurrent: 50 + MAX_HP * POTION_HEAL_FRACTION,
		});

		await call.resolve({ hpCurrent: 95, potions: 1 });
		expect(h.cache.character()).toMatchObject({ hpCurrent: 95, potions: 1 });
	});

	it("restores the potion and hp and refetches when the server refuses", async () => {
		const h = setup();
		const character = characterRow({ hpCurrent: 150, potions: 2 });
		h.seed({ character });

		const call = await h.start("combat.consumePotion", () =>
			h.mutations().consumePotion({ characterId: CHARACTER_ID, clientHp: 50 }),
		);
		const error = await call.reject("Sem poções");

		expect(error.message).toBe("Sem poções");
		expect(h.cache.character()).toEqual(character);
		expect(h.isInvalidated(h.cache.keys.character)).toBe(true);
	});

	it("paints nothing at full life", async () => {
		const h = setup();
		const character = characterRow({ hpCurrent: MAX_HP, potions: 2 });
		h.seed({ character });

		const call = await h.start("combat.consumePotion", () =>
			h.mutations().consumePotion({ characterId: CHARACTER_ID }),
		);
		expect(h.cache.character()).toEqual(character);
		await call.reject("Vida cheia");
	});
});

describe("consumeIncense", () => {
	it("spends one incense optimistically and restores it on rejection", async () => {
		const h = setup();
		const character = characterRow({ etherealIncense: 2 });
		h.seed({ character });

		const call = await h.start("combat.consumeEtherealIncense", () =>
			h.mutations().consumeIncense({ characterId: CHARACTER_ID }),
		);
		expect(h.cache.character()?.etherealIncense).toBe(1);

		await call.reject("Sem incenso");
		expect(h.cache.character()).toEqual(character);
	});

	it("writes the server's count on success", async () => {
		const h = setup();
		h.seed({ character: characterRow({ etherealIncense: 2 }) });
		h.server.reply("combat.consumeEtherealIncense", { etherealIncense: 0 });

		await h.call(() =>
			h.mutations().consumeIncense({ characterId: CHARACTER_ID }),
		);

		expect(h.cache.character()?.etherealIncense).toBe(0);
	});
});

describe("camp", () => {
	it("enterCamp marks the camp and the threshold used", async () => {
		const h = setup();
		h.seed({ character: characterRow() });
		h.server.reply("combat.enterCamp", { inCamp: true });

		await h.call(() =>
			h.mutations().enterCamp({ characterId: CHARACTER_ID, thresholdIndex: 1 }),
		);

		expect(h.cache.character()).toMatchObject({
			inCamp: true,
			lastCampIndex: 1,
		});
	});

	it("enterCampViaIncense and exitCamp toggle the camp flag", async () => {
		const h = setup();
		h.seed({ character: characterRow() });
		h.server.reply("combat.enterCampViaIncense", { inCamp: true });
		h.server.reply("combat.exitCamp", { inCamp: false });

		await h.call(() =>
			h.mutations().enterCampViaIncense({ characterId: CHARACTER_ID }),
		);
		expect(h.cache.character()?.inCamp).toBe(true);

		await h.call(() => h.mutations().exitCamp({ characterId: CHARACTER_ID }));
		expect(h.cache.character()?.inCamp).toBe(false);
	});
});
