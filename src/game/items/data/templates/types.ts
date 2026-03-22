import type { ArmorType, BaseStatKey, EquipmentType, WeaponType } from "../../types"

export interface ImplicitDefinition {
	displayFormat: string
	minValue: number
	maxValue: number
}

export interface EquipmentTemplate {
	id: string
	name: string
	equipmentType: EquipmentType
	weaponType?: WeaponType
	armorType?: ArmorType
	dropLevel: number
	requirements: {
		level: number
		str?: number
		dex?: number
		int?: number
	}
	baseStats: Partial<Record<BaseStatKey, number>>
	implicits: ImplicitDefinition[]
}
