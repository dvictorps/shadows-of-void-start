import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findMonster, type MonsterModId } from "#/game/monsters";
import { overwriteGetLocale } from "#/paraglide/runtime";
import { translateMonsterName } from "./i18n";

const ORIGINAL_LOCALE_GETTER = () => "pt" as const;

afterEach(() => {
	overwriteGetLocale(ORIGINAL_LOCALE_GETTER);
});

function withLocale(locale: "pt" | "en", fn: () => void): void {
	overwriteGetLocale(() => locale);
	fn();
}

describe("translateMonsterName", () => {
	describe("EN", () => {
		beforeEach(() => overwriteGetLocale(() => "en"));

		it("bare name when no mods", () => {
			const goblin = findMonster("goblin");
			if (!goblin) throw new Error("goblin missing");
			expect(translateMonsterName(goblin)).toBe("Goblin");
		});

		it("single prefix stacks before base", () => {
			const goblin = findMonster("goblin");
			if (!goblin) throw new Error("goblin missing");
			const mods: MonsterModId[] = ["monsterIncreasedDamage"];
			expect(translateMonsterName(goblin, mods)).toBe("Vicious Goblin");
		});

		it("single suffix trails with 'of'", () => {
			const goblin = findMonster("goblin");
			if (!goblin) throw new Error("goblin missing");
			expect(
				translateMonsterName(goblin, ["monsterIncreasedAttackSpeed"]),
			).toBe("Goblin of Swiftness");
		});

		it("two suffixes join with 'and'", () => {
			const goblin = findMonster("goblin");
			if (!goblin) throw new Error("goblin missing");
			expect(
				translateMonsterName(goblin, [
					"monsterIncreasedAttackSpeed",
					"monsterColdResistance",
				]),
			).toBe("Goblin of Swiftness and Frost");
		});

		it("two resists collapse into 'Elemental Resistant' prefix", () => {
			const goblin = findMonster("goblin");
			if (!goblin) throw new Error("goblin missing");
			expect(
				translateMonsterName(goblin, [
					"monsterColdResistance",
					"monsterFireResistance",
				]),
			).toBe("Elemental Resistant Goblin");
		});

		it("prefix + compound stacks both prefixes", () => {
			const goblin = findMonster("goblin");
			if (!goblin) throw new Error("goblin missing");
			expect(
				translateMonsterName(goblin, [
					"monsterMoreArmor",
					"monsterColdResistance",
					"monsterFireResistance",
				]),
			).toBe("Armored Elemental Resistant Goblin");
		});
	});

	describe("PT", () => {
		beforeEach(() => overwriteGetLocale(() => "pt"));

		it("bare name when no mods", () => {
			const goblin = findMonster("goblin");
			if (!goblin) throw new Error("goblin missing");
			expect(translateMonsterName(goblin)).toBe("Goblin");
		});

		it("adjective trails masculine base", () => {
			const goblin = findMonster("goblin");
			if (!goblin) throw new Error("goblin missing");
			expect(translateMonsterName(goblin, ["monsterIncreasedDamage"])).toBe(
				"Goblin Furioso",
			);
		});

		it("adjective agrees with feminine base (Serpente Furiosa)", () => {
			const serpente = findMonster("serpente");
			if (!serpente) throw new Error("serpente missing");
			expect(translateMonsterName(serpente, ["monsterIncreasedDamage"])).toBe(
				"Serpente Furiosa",
			);
		});

		it("masculine suffix noun uses 'do'", () => {
			const goblin = findMonster("goblin");
			if (!goblin) throw new Error("goblin missing");
			expect(translateMonsterName(goblin, ["monsterColdResistance"])).toBe(
				"Goblin do Frio",
			);
		});

		it("feminine suffix noun uses 'da'", () => {
			const goblin = findMonster("goblin");
			if (!goblin) throw new Error("goblin missing");
			expect(
				translateMonsterName(goblin, ["monsterIncreasedAttackSpeed"]),
			).toBe("Goblin da Velocidade");
		});

		it("two suffix phrases keep both articles and join with 'e'", () => {
			const goblin = findMonster("goblin");
			if (!goblin) throw new Error("goblin missing");
			expect(
				translateMonsterName(goblin, [
					"monsterIncreasedAttackSpeed",
					"monsterColdResistance",
				]),
			).toBe("Goblin da Velocidade e do Frio");
		});

		it("two resists collapse into 'Resistente a Elementos' adjective", () => {
			const serpente = findMonster("serpente");
			if (!serpente) throw new Error("serpente missing");
			expect(
				translateMonsterName(serpente, [
					"monsterColdResistance",
					"monsterFireResistance",
				]),
			).toBe("Serpente Resistente a Elementos");
		});

		it("prefix + compound: gendered adj then invariable compound", () => {
			const serpente = findMonster("serpente");
			if (!serpente) throw new Error("serpente missing");
			expect(
				translateMonsterName(serpente, [
					"monsterMoreArmor",
					"monsterColdResistance",
					"monsterFireResistance",
				]),
			).toBe("Serpente Blindada Resistente a Elementos");
		});

		it("Robusto/Robusta replaces the old 'Resistente' to avoid collision", () => {
			const goblin = findMonster("goblin");
			if (!goblin) throw new Error("goblin missing");
			const serpente = findMonster("serpente");
			if (!serpente) throw new Error("serpente missing");
			expect(translateMonsterName(goblin, ["monsterIncreasedLife"])).toBe(
				"Goblin Robusto",
			);
			expect(translateMonsterName(serpente, ["monsterIncreasedLife"])).toBe(
				"Serpente Robusta",
			);
		});

		it("base name containing prepositional phrase still inflects suffix adj", () => {
			const criatura = findMonster("criatura_do_vazio");
			if (!criatura) throw new Error("criatura missing");
			expect(translateMonsterName(criatura, ["monsterIncreasedDamage"])).toBe(
				"Criatura do Vazio Furiosa",
			);
		});
	});

	it("locale switch updates rendering live", () => {
		const goblin = findMonster("goblin");
		if (!goblin) throw new Error("goblin missing");
		const mods: MonsterModId[] = ["monsterIncreasedDamage"];
		withLocale("en", () => {
			expect(translateMonsterName(goblin, mods)).toBe("Vicious Goblin");
		});
		withLocale("pt", () => {
			expect(translateMonsterName(goblin, mods)).toBe("Goblin Furioso");
		});
	});
});
