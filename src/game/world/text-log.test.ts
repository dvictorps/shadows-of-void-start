import { describe, expect, it } from "vitest";

import { m } from "#/paraglide/messages";

import { ACT_1, findNode } from ".";
import { translateNodeDescription, translateNodeName } from "./i18n";
import { resolveTextLog } from "./text-log";

const FOREST = findNode(ACT_1, "forest_starter");
const CITY = findNode(ACT_1, "city");

type Input = Parameters<typeof resolveTextLog>[0];

const BASE: Input = {
	act: ACT_1,
	view: "combat",
	deathLog: null,
	consumableHover: null,
	playerHp: 100,
	maxHp: 100,
	potions: 2,
	hoveredNodeId: null,
	currentNode: FOREST,
};

const log = (over: Partial<Input>) => resolveTextLog({ ...BASE, ...over });

describe("resolveTextLog", () => {
	it("puts the death message above everything", () => {
		expect(
			log({ deathLog: "you died", consumableHover: "potion", playerHp: 1 }),
		).toEqual({ message: "you died", tone: "danger" });
	});

	it("shows the hovered consumable's hint in combat, above low HP", () => {
		expect(log({ consumableHover: "incense", playerHp: 1 })).toEqual({
			message: m.incense_hint(),
			tone: "info",
		});
	});

	it("ignores a consumable hover outside combat", () => {
		expect(log({ view: "city", consumableHover: "potion" }).message).toBe(
			m.inside_zone({ zone: translateNodeName(FOREST!) }),
		);
	});

	it("warns under 30% life, by potion stock", () => {
		expect(log({ playerHp: 29 })).toEqual({
			message: m.low_hp_use_potion(),
			tone: "warning",
		});
		expect(log({ playerHp: 29, potions: 0 }).message).toBe(
			m.low_hp_no_potions(),
		);
	});

	it("does not warn at exactly 30%, at zero life, or outside combat", () => {
		expect(log({ playerHp: 30 }).tone).toBe("info");
		expect(log({ playerHp: 0 }).tone).toBe("info");
		expect(log({ view: "map", playerHp: 1 }).tone).toBe("info");
	});

	it("describes the hovered node on the map", () => {
		const hovered = findNode(ACT_1, "pantano")!;
		expect(log({ view: "map", hoveredNodeId: "pantano" }).message).toBe(
			translateNodeDescription(hovered) ?? translateNodeName(hovered),
		);
	});

	it("shows the act label on an idle map", () => {
		expect(log({ view: "map" }).message).toBe(m.act_map_label({ number: 1 }));
		expect(log({ view: "map", hoveredNodeId: "nowhere" }).message).toBe(
			m.act_map_label({ number: 1 }),
		);
	});

	it("names the current area in the city and in combat", () => {
		expect(log({ view: "city", currentNode: CITY }).message).toBe(
			m.inside_zone({ zone: translateNodeName(CITY!) }),
		);
		expect(log({}).message).toBe(
			m.inside_zone({ zone: translateNodeName(FOREST!) }),
		);
	});

	it("falls back to an empty info line", () => {
		expect(log({ currentNode: null })).toEqual({
			message: undefined,
			tone: "info",
		});
	});
});
