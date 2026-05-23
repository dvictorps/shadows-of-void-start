// Sentinel example for docs/playbooks/adding-a-class.md — step 1.
// If this stops compiling, the playbook is out of date.
//
// Demonstrates: a class definition with primaryAttribute + base hp /
// barrier / attributes.
//
// Note: CharacterClassId is a closed union ("warrior" | "mage" | "rogue")
// — this sentinel reuses an existing id so it type-checks without
// pretending a fourth class exists.

import type { CharacterClassDefinition } from "#/game/classes/types";

export const PLAYBOOK_CLASS_EXAMPLE: CharacterClassDefinition = {
	id: "warrior",
	name: "Templar (example shape — reuses warrior id)",
	description:
		"Sacred warrior who channels divine power into martial discipline.",
	primaryAttribute: "strength",
	baseStats: {
		hp: 80,
		barrier: 10,
		attributes: { strength: 8, dexterity: 4, intelligence: 8 },
	},
};
