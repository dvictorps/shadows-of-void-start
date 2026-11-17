export const STASH_MODES = ["softcore", "hardcore"] as const;
export type StashMode = (typeof STASH_MODES)[number];

export function stashModeOf(character: { hardcore: boolean }): StashMode {
	return character.hardcore ? "hardcore" : "softcore";
}
