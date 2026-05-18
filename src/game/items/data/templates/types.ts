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
	name: string;
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
}
