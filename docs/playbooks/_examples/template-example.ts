// Sentinel example for docs/playbooks/adding-an-equipment-template.md — step 1.
// If this stops compiling, the playbook is out of date.
//
// Demonstrates: a sword template tier with one implicit. nameBase /
// nameModifier reference the literal unions in lexicon/template-ids.ts,
// so a typo here is also a compile error.

import type { EquipmentTemplate } from "#/game/items/data/templates";

export const PLAYBOOK_TEMPLATE_EXAMPLE: EquipmentTemplate = {
	id: "sword_example",
	nameBase: "sword",
	nameModifier: "war",
	equipmentType: "weapon",
	weaponType: "sword",
	dropLevel: 14,
	requirements: { level: 14, str: 28, dex: 28 },
	baseStats: {
		minDamage: 14,
		maxDamage: 32,
		attackSpeed: 1.5,
		criticalChance: 5,
	},
	implicits: [
		{
			modifierId: "accuracyFlat",
			displayFormat: "+{value} Accuracy Rating",
			minValue: 130,
			maxValue: 180,
		},
	],
};
