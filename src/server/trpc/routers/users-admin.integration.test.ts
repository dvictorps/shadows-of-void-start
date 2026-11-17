import { describe, expect, it } from "vitest";

import { SERVER_ERRORS } from "#/lib/server-errors";

import {
	callerFor,
	createAccount,
	createPlayableCharacter,
	expectServerError,
} from "../../test/harness";

describe("users", () => {
	it("returns null for a signed-out caller", async () => {
		expect(await callerFor(null).users.getUserRole()).toBeNull();
		expect(await callerFor(null).users.isAdmin()).toBe(false);
	});

	it("returns the caller's role and identity", async () => {
		const account = await createAccount();
		expect(await account.caller.users.getUserRole()).toEqual({
			authUserId: account.session.user.id,
			role: "user",
			name: account.session.user.name,
			email: account.session.user.email,
		});
	});

	it("lets an admin promote another user", async () => {
		const admin = await createAccount("admin");
		const target = await createAccount();
		await admin.caller.users.setUserRole({
			authUserId: target.session.user.id,
			role: "admin",
		});
		const listed = await admin.caller.admin.listAdmins();
		expect(listed.map((a) => a.authUserId)).toContain(target.session.user.id);
	});

	it("rejects a non-admin and a self-revoke", async () => {
		const admin = await createAccount("admin");
		const player = await createAccount();
		await expectServerError(
			player.caller.users.setUserRole({
				authUserId: player.session.user.id,
				role: "admin",
			}),
			SERVER_ERRORS.adminRequired,
		);
		await expectServerError(
			admin.caller.users.setUserRole({
				authUserId: admin.session.user.id,
				role: "user",
			}),
			"Cannot revoke your own admin role",
		);
		await expectServerError(
			admin.caller.users.setUserRole({ authUserId: "nobody", role: "user" }),
			"User not found",
		);
	});

	it("reads the admin role from D1, not from the cached session", async () => {
		const demoted = await createAccount("admin");
		const other = await createAccount("admin");
		await other.caller.users.setUserRole({
			authUserId: demoted.session.user.id,
			role: "user",
		});
		await expectServerError(
			demoted.caller.admin.pulse(),
			SERVER_ERRORS.adminRequired,
		);
	});
});

describe("admin", () => {
	it("counts users and characters with SQL", async () => {
		const admin = await createAccount("admin");
		const before = await admin.caller.admin.pulse();
		const player = await createAccount();
		await createPlayableCharacter(player, "warrior", true);
		await createPlayableCharacter(player, "mage");

		const after = await admin.caller.admin.pulse();
		expect(after.userCount).toBe(before.userCount + 1);
		expect(after.characterCount).toBe(before.characterCount + 2);
		expect(after.hardcoreCount).toBe(before.hardcoreCount + 1);
		expect(after.softcoreCount).toBe(before.softcoreCount + 1);

		const users = await admin.caller.admin.listUsers();
		const row = users.find((u) => u.authUserId === player.session.user.id);
		expect(row?.characterCount).toBe(2);

		const chars = await admin.caller.admin.listCharactersForUser({
			authUserId: player.session.user.id,
		});
		expect(chars.map((c) => c.classId)).toEqual(["mage", "warrior"]);
	});
});
