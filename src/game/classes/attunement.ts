import type { SelectableElement } from "../stats/types";
import type { CharacterClassId } from "./types";

// CONTEXT.md → Elemental Attunement. A mage starts attuned to fire; other
// classes have no attunement. Shared by character creation (server) and the
// client's stat computation before the row's value has loaded.
export function defaultElementFor(
	classId: CharacterClassId,
): SelectableElement | null {
	return classId === "mage" ? "fire" : null;
}
