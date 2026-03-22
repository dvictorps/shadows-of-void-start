// ── Character attributes ──

export interface CharacterAttributes {
	strength: number
	dexterity: number
	intelligence: number
}

// ── Base character stats (before gear) ──

export interface CharacterBaseStats {
	hp: number
	barrier: number
	attributes: CharacterAttributes
}

// ── Class definition ──

export type CharacterClassId = "warrior" | "mage" | "rogue"

export interface CharacterClassDefinition {
	id: CharacterClassId
	name: string
	description: string
	primaryAttribute: keyof CharacterAttributes
	baseStats: CharacterBaseStats
}
