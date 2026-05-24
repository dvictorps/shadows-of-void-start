import { m } from "#/paraglide/messages";
import { findClassDefinition } from "./data";
import type { CharacterClassId } from "./types";

const CLASS_NAME: Record<CharacterClassId, () => string> = {
	warrior: m.class_warrior_name,
	rogue: m.class_rogue_name,
	mage: m.class_mage_name,
};

export function getClassDisplayName(classId: string): string {
	const def = findClassDefinition(classId);
	return def ? CLASS_NAME[def.id]() : m.unknown_class();
}
