import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findMonster, type MonsterModId } from "#/game/monsters";
import { overwriteGetLocale } from "#/paraglide/runtime";
import {
	type NameableEnemy,
	type RareNameSeed,
	translateEnemyName,
	translateMonsterName,
} from "./i18n";

function makeRareEnemy(
	monsterId: string,
	mods: MonsterModId[],
	seed: RareNameSeed,
): NameableEnemy {
	const def = findMonster(monsterId);
	if (!def) throw new Error(`unknown monster ${monsterId}`);
	return { def, mods, rarity: "rare", nameSeed: seed };
}

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

describe("translateEnemyName — rare proper names", () => {
	// Seed = 0 maps to the first entry in every pool, which makes the expected
	// output stable as long as the lexicon's first entries don't change. If
	// reordering a pool, the tests below need a matching update.
	const ZERO_SEED: RareNameSeed = { primary: 0, secondary: 0, epithet: 0 };

	describe("EN", () => {
		beforeEach(() => overwriteGetLocale(() => "en"));

		it("compounds first + second word with no space, then comma + epithet", () => {
			const enemy = makeRareEnemy(
				"goblin",
				["monsterIncreasedDamage"],
				ZERO_SEED,
			);
			expect(translateEnemyName(enemy)).toBe("Ironmaw, the Furious");
		});

		it("epithet pool comes from the prefix mod, not from suffixes", () => {
			const enemy = makeRareEnemy(
				"goblin",
				[
					"monsterIncreasedEvasion",
					"monsterIncreasedAttackSpeed",
					"monsterColdResistance",
				],
				ZERO_SEED,
			);
			expect(translateEnemyName(enemy)).toBe("Ironmaw, the Elusive");
		});

		it("two resists collapse into the compound epithet pool", () => {
			const enemy = makeRareEnemy(
				"goblin",
				["monsterMoreArmor", "monsterColdResistance", "monsterFireResistance"],
				ZERO_SEED,
			);
			expect(translateEnemyName(enemy)).toBe("Ironmaw, the Unbroken");
		});
	});

	describe("PT", () => {
		beforeEach(() => overwriteGetLocale(() => "pt"));

		it("joins noun + 'de/do/da X' phrase with comma + masculine epithet", () => {
			const enemy = makeRareEnemy(
				"goblin",
				["monsterIncreasedDamage"],
				ZERO_SEED,
			);
			expect(translateEnemyName(enemy)).toBe("Braço de Sangue, o Furioso");
		});

		it("epithet stays masculine regardless of monster grammatical gender", () => {
			// "Serpente" is a feminine word, but the rare epithet refers to the
			// monster as an entity (genderless) — always masculine.
			const enemy = makeRareEnemy("serpente", ["monsterMoreArmor"], ZERO_SEED);
			expect(translateEnemyName(enemy)).toBe("Braço de Sangue, o Blindado");
		});

		it("compound rule swaps to 'o Inquebrável'-style title", () => {
			const enemy = makeRareEnemy(
				"goblin",
				[
					"monsterIncreasedLife",
					"monsterColdResistance",
					"monsterFireResistance",
				],
				ZERO_SEED,
			);
			expect(translateEnemyName(enemy)).toBe("Braço de Sangue, o Inquebrável");
		});
	});

	it("same seed produces the same name across calls (stable rendering)", () => {
		overwriteGetLocale(() => "pt");
		const seed: RareNameSeed = { primary: 0.42, secondary: 0.71, epithet: 0.3 };
		const enemy = makeRareEnemy("goblin", ["monsterIncreasedDamage"], seed);
		const a = translateEnemyName(enemy);
		const b = translateEnemyName(enemy);
		expect(a).toBe(b);
	});

	it("different seeds usually produce different names", () => {
		overwriteGetLocale(() => "en");
		const e1 = makeRareEnemy("goblin", ["monsterIncreasedDamage"], {
			primary: 0,
			secondary: 0,
			epithet: 0,
		});
		const e2 = makeRareEnemy("goblin", ["monsterIncreasedDamage"], {
			primary: 0.9,
			secondary: 0.9,
			epithet: 0.9,
		});
		expect(translateEnemyName(e1)).not.toBe(translateEnemyName(e2));
	});

	it("non-rare enemies fall through to the mod-based renderer", () => {
		overwriteGetLocale(() => "pt");
		const def = findMonster("goblin");
		if (!def) throw new Error("goblin missing");
		const enemy: NameableEnemy = {
			def,
			mods: ["monsterIncreasedDamage"],
			rarity: "magic",
			nameSeed: ZERO_SEED,
		};
		// Magic still uses the prefix/suffix system — no proper name yet.
		expect(translateEnemyName(enemy)).toBe("Goblin Furioso");
	});
});
