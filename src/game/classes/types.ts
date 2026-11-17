export interface CharacterAttributes {
	strength: number;
	dexterity: number;
	intelligence: number;
}

export interface CharacterBaseStats {
	hp: number;
	barrier: number;
	attributes: CharacterAttributes;
}

export type CharacterClassId = "warrior" | "mage" | "rogue";

export interface CharacterClassDefinition {
	id: CharacterClassId;
	name: string;
	description: string;
	primaryAttribute: keyof CharacterAttributes;
	baseStats: CharacterBaseStats;
}
