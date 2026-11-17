import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { MAX_CHARACTERS_PER_USER } from "#/game/classes/new-character";
import { SERVER_ERRORS } from "#/lib/server-errors";

import { db } from "../../db/client";
import { items } from "../../db/schema";
import {
	createAccount,
	createPlayableCharacter,
	expectServerError,
	patchCharacter,
	readCharacter,
} from "../../test/harness";

describe("characters", () => {
	it("creates a character with its starter gear and stat cache", async () => {
		const account = await createAccount();
		const id = await account.caller.characters.create({
			name: "  Rogue One ",
			classId: "rogue",
		});
		const row = await readCharacter(id);
		expect(row.name).toBe("Rogue One");
		expect(row.potions).toBe(5);
		expect(row.hpCurrent).toBe(row.cachedMaxLife);
		expect(row.unlockedNodes).toEqual(["city"]);
		expect(row.zoneBag).toEqual([]);

		const gear = await db.select().from(items).where(eq(items.characterId, id));
		expect(
			gear
				.map((g) => g.equippedSlot ?? "")
				.toSorted((x, y) => x.localeCompare(y)),
		).toEqual(["chestplate", "weapon"]);
		expect(gear.every((g) => g.authUserId === account.session.user.id)).toBe(
			true,
		);
	});

	it("equips a new mage with the starter wand and tome", async () => {
		const account = await createAccount();
		const id = await account.caller.characters.create({
			name: "Apprentice",
			classId: "mage",
		});
		const gear = await db.select().from(items).where(eq(items.characterId, id));
		expect(
			gear
				.map((g) => `${g.equippedSlot ?? ""}:${g.data.templateId}`)
				.toSorted((x, y) => x.localeCompare(y)),
		).toEqual(["offhand:tome_t1", "weapon:cracked_wand"]);
	});

	it("enforces name and roster rules", async () => {
		const account = await createAccount();
		await account.caller.characters.create({ name: "Taken", classId: "mage" });
		await expectServerError(
			account.caller.characters.create({ name: "taken", classId: "mage" }),
			SERVER_ERRORS.duplicateName,
		);
		await expectServerError(
			account.caller.characters.create({ name: "   ", classId: "mage" }),
			SERVER_ERRORS.nameEmpty,
		);
		await expectServerError(
			account.caller.characters.create({
				name: "x".repeat(21),
				classId: "mage",
			}),
			"Name must be at most 20 characters",
		);
		await expectServerError(
			account.caller.characters.create({ name: "Bard", classId: "bard" }),
			"Unknown class: bard",
		);
		for (let i = 1; i < MAX_CHARACTERS_PER_USER; i++) {
			await account.caller.characters.create({
				name: `Alt ${i}`,
				classId: "rogue",
			});
		}
		await expectServerError(
			account.caller.characters.create({ name: "One more", classId: "rogue" }),
			`Max ${MAX_CHARACTERS_PER_USER} characters per account`,
		);
	});

	it("lists only the caller's living characters and hides other accounts'", async () => {
		const account = await createAccount();
		const other = await createAccount();
		const alive = await createPlayableCharacter(account);
		const fallen = await createPlayableCharacter(account, "rogue", true);
		await patchCharacter(fallen.characterId, { dead: true });
		const foreign = await createPlayableCharacter(other);

		const listed = await account.caller.characters.list();
		expect(listed.map((c) => c.id)).toEqual([alive.characterId]);
		expect(listed[0]).not.toHaveProperty("zoneBag");

		expect(
			await account.caller.characters.byId({ id: foreign.characterId }),
		).toBeNull();
	});

	it("removes a character and cascades its items, but not another account's", async () => {
		const account = await createAccount();
		const other = await createAccount();
		const hero = await createPlayableCharacter(account);
		await expectServerError(
			other.caller.characters.remove({ id: hero.characterId }),
			SERVER_ERRORS.notYourCharacter,
		);
		await account.caller.characters.remove({ id: hero.characterId });
		const left = await db
			.select()
			.from(items)
			.where(eq(items.characterId, hero.characterId));
		expect(left).toEqual([]);
	});

	it("rotates the session token so the old tab is locked out", async () => {
		const account = await createAccount();
		const hero = await createPlayableCharacter(account);
		await account.caller.characters.claimCharacterSession({
			characterId: hero.characterId,
			sessionToken: "tab-b",
		});
		await expectServerError(
			account.caller.combat.enterCity(hero),
			SERVER_ERRORS.sessionLost,
		);
		const other = await createAccount();
		await expectServerError(
			other.caller.characters.claimCharacterSession({
				characterId: hero.characterId,
				sessionToken: "x",
			}),
			SERVER_ERRORS.notYourCharacter,
		);
	});
});
