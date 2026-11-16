// Error messages the server throws and the client translates
// (`translateServerError` in convex-errors.ts). One source so a rename can't
// silently break the translation. Kept dependency-free: both bundles import it.
export const SERVER_ERRORS = {
	notAuthenticated: "Not authenticated",
	characterNotFound: "Character not found",
	notYourCharacter: "Not your character",
	sessionLost: "Session lost",
} as const;
