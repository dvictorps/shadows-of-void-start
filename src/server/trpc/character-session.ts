import { TRPCError } from "@trpc/server";

import { SERVER_ERRORS } from "#/lib/server-errors";

interface SessionOwnedCharacter {
	authUserId: string;
	activeSessionToken: string | null;
}

interface SessionClaim {
	authUserId: string;
	sessionToken: string;
}

// Single active session per character (threat #5 in
// docs/security/threat-model.md). A second tab that claims the character
// rotates `activeSessionToken`; every later write from the first tab fails
// here and the client shows the "Session lost" modal. Read-only procedures
// skip this, so a stale tab can still observe its character.
export function assertCharacterSession<Character extends SessionOwnedCharacter>(
	character: Character | undefined,
	claim: SessionClaim,
): Character {
	if (!character) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: SERVER_ERRORS.characterNotFound,
		});
	}
	if (character.authUserId !== claim.authUserId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: SERVER_ERRORS.notYourCharacter,
		});
	}
	if (character.activeSessionToken !== claim.sessionToken) {
		throw new TRPCError({
			code: "CONFLICT",
			message: SERVER_ERRORS.sessionLost,
		});
	}
	return character;
}
