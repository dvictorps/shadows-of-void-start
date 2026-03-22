import type { CharacterClassDefinition, CharacterClassId } from "./types"

export const CLASS_DEFINITIONS: Record<CharacterClassId, CharacterClassDefinition> = {
  warrior: {
    id: "warrior",
    name: "Warrior",
    description: "A battle-hardened fighter who relies on raw strength and heavy armor to overpower enemies.",
    primaryAttribute: "strength",
    baseStats: {
      hp: 100,
      barrier: 0,
      attributes: { strength: 10, dexterity: 5, intelligence: 5 },
    },
  },
  rogue: {
    id: "rogue",
    name: "Rogue",
    description: "A swift and cunning combatant who exploits precision and agility to strike where it hurts most.",
    primaryAttribute: "dexterity",
    baseStats: {
      hp: 60,
      barrier: 0,
      attributes: { strength: 5, dexterity: 10, intelligence: 5 },
    },
  },
  mage: {
    id: "mage",
    name: "Mage",
    description: "A wielder of arcane power who sacrifices physical resilience for devastating magical potential and a natural energy barrier.",
    primaryAttribute: "intelligence",
    baseStats: {
      hp: 40,
      barrier: 20,
      attributes: { strength: 5, dexterity: 5, intelligence: 10 },
    },
  },
} as const

export function getClassDefinition(id: CharacterClassId): CharacterClassDefinition {
  return CLASS_DEFINITIONS[id]
}
