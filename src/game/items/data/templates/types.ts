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
	modifierId: ModifierId;
	displayFormat: string;
	minValue: number;
	maxValue: number;
}

export interface EquipmentTemplate {
	id: string;
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
	icon?: string;
}
