// The stash belongs to the account, one per mode (CONTEXT.md → Stash).
// Shared by the server procedures and the client's optimistic updates, so
// both pick the same stash for a character.

export const STASH_MODES = ["softcore", "hardcore"] as const;
export type StashMode = (typeof STASH_MODES)[number];

/** A character's stash is the account's stash for its mode. */
export function stashModeOf(character: { hardcore: boolean }): StashMode {
	return character.hardcore ? "hardcore" : "softcore";
}
