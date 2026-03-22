import { describe, it, expect } from "vitest"
import { CLASS_DEFINITIONS, getClassDefinition } from "./data"
import type { CharacterClassId } from "./types"

describe("CLASS_DEFINITIONS", () => {
  it("defines exactly 3 classes", () => {
    expect(Object.keys(CLASS_DEFINITIONS)).toHaveLength(3)
  })

  it("has warrior, mage, and rogue", () => {
    expect(CLASS_DEFINITIONS).toHaveProperty("warrior")
    expect(CLASS_DEFINITIONS).toHaveProperty("mage")
    expect(CLASS_DEFINITIONS).toHaveProperty("rogue")
  })
})

describe("Warrior", () => {
  const warrior = CLASS_DEFINITIONS.warrior

  it("has strength as primary attribute", () => {
    expect(warrior.primaryAttribute).toBe("strength")
  })

  it("starts with 10 strength, 5 dex, 5 int", () => {
    expect(warrior.baseStats.attributes).toEqual({
      strength: 10, dexterity: 5, intelligence: 5,
    })
  })

  it("has 100 base HP", () => {
    expect(warrior.baseStats.hp).toBe(100)
  })

  it("has 0 base barrier", () => {
    expect(warrior.baseStats.barrier).toBe(0)
  })
})

describe("Mage", () => {
  const mage = CLASS_DEFINITIONS.mage

  it("has intelligence as primary attribute", () => {
    expect(mage.primaryAttribute).toBe("intelligence")
  })

  it("starts with 5 strength, 5 dex, 10 int", () => {
    expect(mage.baseStats.attributes).toEqual({
      strength: 5, dexterity: 5, intelligence: 10,
    })
  })

  it("has 40 base HP", () => {
    expect(mage.baseStats.hp).toBe(40)
  })

  it("has 20 base barrier", () => {
    expect(mage.baseStats.barrier).toBe(20)
  })
})

describe("Rogue", () => {
  const rogue = CLASS_DEFINITIONS.rogue

  it("has dexterity as primary attribute", () => {
    expect(rogue.primaryAttribute).toBe("dexterity")
  })

  it("starts with 5 strength, 10 dex, 5 int", () => {
    expect(rogue.baseStats.attributes).toEqual({
      strength: 5, dexterity: 10, intelligence: 5,
    })
  })

  it("has 60 base HP", () => {
    expect(rogue.baseStats.hp).toBe(60)
  })

  it("has 0 base barrier", () => {
    expect(rogue.baseStats.barrier).toBe(0)
  })
})

describe("getClassDefinition", () => {
  it("returns the correct class for each id", () => {
    const ids: CharacterClassId[] = ["warrior", "mage", "rogue"]
    for (const id of ids) {
      expect(getClassDefinition(id).id).toBe(id)
    }
  })
})
