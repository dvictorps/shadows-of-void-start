import type { SelectableElement } from "../stats/types";
import type { CharacterClassId } from "./types";

export function defaultElementFor(
	classId: CharacterClassId,
): SelectableElement | null {
	return classId === "mage" ? "fire" : null;
}
