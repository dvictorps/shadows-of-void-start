import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import { SERVER_ERRORS } from "#/lib/server-errors";

import { assertCharacterSession } from "./character-session";

const claim = { authUserId: "user-1", sessionToken: "tab-a" };
const character = { id: 7, authUserId: "user-1", activeSessionToken: "tab-a" };

function rejection(run: () => void): TRPCError {
	try {
		run();
	} catch (error) {
		if (error instanceof TRPCError) return error;
	}
	throw new Error("expected a TRPCError");
}

describe("assertCharacterSession", () => {
	it("returns the character when owner and token match", () => {
		expect(assertCharacterSession(character, claim)).toBe(character);
	});

	it("rejects a missing character", () => {
		const error = rejection(() => assertCharacterSession(undefined, claim));
		expect(error.code).toBe("NOT_FOUND");
		expect(error.message).toBe(SERVER_ERRORS.characterNotFound);
	});

	it("rejects another account's character", () => {
		const error = rejection(() =>
			assertCharacterSession({ ...character, authUserId: "user-2" }, claim),
		);
		expect(error.code).toBe("FORBIDDEN");
		expect(error.message).toBe(SERVER_ERRORS.notYourCharacter);
	});

	it("rejects a stale tab after another one claimed the character", () => {
		const error = rejection(() =>
			assertCharacterSession(
				{ ...character, activeSessionToken: "tab-b" },
				claim,
			),
		);
		expect(error.code).toBe("CONFLICT");
		expect(error.message).toBe(SERVER_ERRORS.sessionLost);
	});

	it("rejects a character nobody has claimed yet", () => {
		const error = rejection(() =>
			assertCharacterSession({ ...character, activeSessionToken: null }, claim),
		);
		expect(error.message).toBe(SERVER_ERRORS.sessionLost);
	});
});
