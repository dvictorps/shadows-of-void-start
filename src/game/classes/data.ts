import type { CharacterClassDefinition, CharacterClassId } from "./types";

export const CLASS_DEFINITIONS = {
	warrior: {
		id: "warrior",
		name: "Guerreiro",
		description:
			"Lutador endurecido em batalha que conta com força bruta e armadura pesada para subjugar inimigos.",
		primaryAttribute: "strength",
		baseStats: {
			hp: 100,
			barrier: 0,
			attributes: { strength: 10, dexterity: 5, intelligence: 5 },
		},
	},
	rogue: {
		id: "rogue",
		name: "Ladino",
		description:
			"Combatente ágil e astuto que explora precisão e agilidade para acertar onde mais dói.",
		primaryAttribute: "dexterity",
		baseStats: {
			hp: 60,
			barrier: 0,
			attributes: { strength: 5, dexterity: 10, intelligence: 5 },
		},
	},
	mage: {
		id: "mage",
		name: "Mago",
		description:
			"Conjurador arcano que troca resiliência física por potencial mágico devastador e uma barreira de energia natural.",
		primaryAttribute: "intelligence",
		baseStats: {
			hp: 40,
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
