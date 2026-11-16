import { TRPCError } from "@trpc/server";

import { SERVER_ERRORS } from "#/lib/server-errors";

import { forbidden, notFound } from "./errors";

interface OwnedCharacter {
	authUserId: string;
}

interface SessionOwnedCharacter extends OwnedCharacter {
	activeSessionToken: string | null;
}

interface SessionClaim {
	authUserId: string;
	sessionToken: string;
}

/** The character exists and belongs to `authUserId`. */
export function assertOwnsCharacter<Character extends OwnedCharacter>(
	character: Character | undefined,
	authUserId: string,
): Character {
	if (!character) notFound(SERVER_ERRORS.characterNotFound);
	if (character.authUserId !== authUserId) {
		forbidden(SERVER_ERRORS.notYourCharacter);
	}
	return character;
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
	const owned = assertOwnsCharacter(character, claim.authUserId);
	if (owned.activeSessionToken !== claim.sessionToken) {
		throw new TRPCError({
			code: "CONFLICT",
			message: SERVER_ERRORS.sessionLost,
		});
	}
	return owned;
}
