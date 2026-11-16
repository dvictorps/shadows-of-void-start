import { hashPassword as betterAuthHash } from "better-auth/crypto";
import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("native scrypt password hasher", () => {
	it("verifies its own hash", async () => {
		const hash = await hashPassword("correct horse");
		await expect(
			verifyPassword({ hash, password: "correct horse" }),
		).resolves.toBe(true);
	});

	it("rejects a wrong password", async () => {
		const hash = await hashPassword("correct horse");
		await expect(
			verifyPassword({ hash, password: "battery staple" }),
		).resolves.toBe(false);
	});

	it("rejects a malformed hash instead of throwing", async () => {
		await expect(
			verifyPassword({ hash: "not-a-hash", password: "x" }),
		).resolves.toBe(false);
	});

	it("reads hashes made by Better Auth's default hasher", async () => {
		const hash = await betterAuthHash("correct horse");
		await expect(
			verifyPassword({ hash, password: "correct horse" }),
		).resolves.toBe(true);
	});
});
