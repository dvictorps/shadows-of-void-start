// Sentinel example for docs/playbooks/adding-a-modifier.md — step 1.
// If this stops compiling, the playbook is out of date.
//
// Demonstrates: a global increased prefix with weight + tier range.

import { createStandardTiers } from "#/game/items/types/mods";
import type { Modifier } from "#/game/items/types/mods";

export const PLAYBOOK_MODIFIER_EXAMPLE: Modifier = {
	id: "myNewStatIncrease",
	affixType: "prefix",
	modifierType: "increased",
	category: "offensive",
	applicableTo: ["allArmor", "ring"],
	displayFormat: "+{value}% Some Stat",
	isGlobalStat: true,
	weight: 800,
	tiers: createStandardTiers(5, 10, 30, 45),
};
