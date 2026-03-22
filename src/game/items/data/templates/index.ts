export type { EquipmentTemplate, ImplicitDefinition } from "./types";

import { AMULET_TEMPLATES } from "./amulets";
import { AXE_TEMPLATES } from "./axes";
import { BELT_TEMPLATES } from "./belts";
import { BOOT_TEMPLATES } from "./boots";
import { BOW_TEMPLATES } from "./bows";
import { CHESTPLATE_TEMPLATES } from "./chestplates";
import { DAGGER_TEMPLATES } from "./daggers";
import { GLOVE_TEMPLATES } from "./gloves";
import { GREATSWORD_TEMPLATES } from "./greatswords";
import { HELMET_TEMPLATES } from "./helmets";
import { MACE_TEMPLATES } from "./maces";
import { RING_TEMPLATES } from "./rings";
import { SHIELD_TEMPLATES } from "./shields";
import { STAFF_TEMPLATES } from "./staves";
import { SWORD_TEMPLATES } from "./swords";
import { TWO_HANDED_AXE_TEMPLATES } from "./two-handed-axes";
import type { EquipmentTemplate } from "./types";
import { WAND_TEMPLATES } from "./wands";

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
];

export const TEMPLATE_BY_ID = new Map(
	EQUIPMENT_TEMPLATES.map((t) => [t.id, t]),
);
