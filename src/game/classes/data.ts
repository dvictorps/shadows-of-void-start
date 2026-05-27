import type { CharacterClassDefinition, CharacterClassId } from "./types";

export const CLASS_DEFINITIONS = {
	warrior: {
		id: "warrior",
		name: "Warrior",
		description:
			"A battle-hardened fighter who relies on raw strength and heavy armor to overpower enemies.",
		primaryAttribute: "strength",
		baseStats: {
			hp: 70,
			barrier: 0,
			attributes: { strength: 10, dexterity: 5, intelligence: 5 },
		},
	},
	rogue: {
		id: "rogue",
		name: "Rogue",
		description:
			"A swift and cunning combatant who exploits precision and agility to strike where it hurts most.",
		primaryAttribute: "dexterity",
		baseStats: {
			hp: 50,
			barrier: 0,
			attributes: { strength: 5, dexterity: 10, intelligence: 5 },
		},
	},
	mage: {
		id: "mage",
		name: "Mage",
		description:
			"A wielder of arcane power who sacrifices physical resilience for devastating magical potential and a natural energy barrier.",
		primaryAttribute: "intelligence",
		baseStats: {
			hp: 30,
			barrier: 20,
			attributes: { strength: 5, dexterity: 5, intelligence: 10 },
		},
	},
} as const satisfies Record<CharacterClassId, CharacterClassDefinition>;

export function getClassDefinition(
	id: CharacterClassId,
): CharacterClassDefinition {
	return CLASS_DEFINITIONS[id];
}

function isClassId(id: string): id is CharacterClassId {
	return Object.hasOwn(CLASS_DEFINITIONS, id);
}

/**
 * Safe lookup for a class id that may have come from persisted data.
 * Returns null if the id is unknown (e.g., a class was removed from game data
 * but a character with that classId still exists in the database).
 */
export function findClassDefinition(
	id: string,
): CharacterClassDefinition | null {
	return isClassId(id) ? CLASS_DEFINITIONS[id] : null;
}
