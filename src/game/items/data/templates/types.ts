import type {
	TemplateBaseId,
	TemplateModifierId,
} from "../../lexicon/template-ids";
import type {
	ArmorType,
	BaseStatKey,
	EquipmentType,
	WeaponType,
} from "../../types";
import type { ModifierId } from "../modifiers";

export interface ImplicitDefinition {
	// Routes the rolled value through the stat engine via applyModifierValue.
	// Must reference an existing modifier id so the engine knows how to apply it.
	modifierId: ModifierId;
	displayFormat: string;
	minValue: number;
	maxValue: number;
}

export interface EquipmentTemplate {
	id: string;
	// Naming decomposition for the lexicon system — see
	// src/game/items/lexicon/{en,pt}.ts. The renderer composes the display
	// name as `<base> <modifier>` (PT, with gender concord) or
	// `<modifier> <base>` (EN). `nameModifier` is null for bases that stand
	// alone (none today, but kept open for future plain bases like "Crown").
	nameBase: TemplateBaseId;
	nameModifier: TemplateModifierId | null;
	equipmentType: EquipmentType;
	weaponType?: WeaponType;
	armorType?: ArmorType;
	dropLevel: number;
	requirements: {
		level: number;
		str?: number;
		dex?: number;
		int?: number;
	};
	baseStats: Partial<Record<BaseStatKey, number>>;
	implicits: ImplicitDefinition[];
	// Public path to the base's sprite. When undefined, ItemCard falls back to
	// the equipment-type/weapon-type emoji.
	icon?: string;
}
