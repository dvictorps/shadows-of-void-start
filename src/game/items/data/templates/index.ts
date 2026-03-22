export type { EquipmentTemplate, ImplicitDefinition } from "./types"

import { SWORD_TEMPLATES } from "./swords"
import { GREATSWORD_TEMPLATES } from "./greatswords"
import { DAGGER_TEMPLATES } from "./daggers"
import { BOW_TEMPLATES } from "./bows"
import { AXE_TEMPLATES } from "./axes"
import { MACE_TEMPLATES } from "./maces"
import { TWO_HANDED_AXE_TEMPLATES } from "./two-handed-axes"
import { STAFF_TEMPLATES } from "./staves"
import { WAND_TEMPLATES } from "./wands"
import { HELMET_TEMPLATES } from "./helmets"
import { CHESTPLATE_TEMPLATES } from "./chestplates"
import { BOOT_TEMPLATES } from "./boots"
import { GLOVE_TEMPLATES } from "./gloves"
import { SHIELD_TEMPLATES } from "./shields"
import { RING_TEMPLATES } from "./rings"
import { AMULET_TEMPLATES } from "./amulets"
import { BELT_TEMPLATES } from "./belts"

import type { EquipmentTemplate } from "./types"

export const EQUIPMENT_TEMPLATES: EquipmentTemplate[] = [
	// Weapons
	...SWORD_TEMPLATES,
	...GREATSWORD_TEMPLATES,
	...DAGGER_TEMPLATES,
	...BOW_TEMPLATES,
	...AXE_TEMPLATES,
	...MACE_TEMPLATES,
	...TWO_HANDED_AXE_TEMPLATES,
	...STAFF_TEMPLATES,
	...WAND_TEMPLATES,
	// Armor
	...HELMET_TEMPLATES,
	...CHESTPLATE_TEMPLATES,
	...BOOT_TEMPLATES,
	...GLOVE_TEMPLATES,
	// Offhand
	...SHIELD_TEMPLATES,
	// Jewelry
	...RING_TEMPLATES,
	...AMULET_TEMPLATES,
	...BELT_TEMPLATES,
]

export const TEMPLATE_BY_ID = new Map(
	EQUIPMENT_TEMPLATES.map((t) => [t.id, t]),
)
