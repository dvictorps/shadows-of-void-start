import { WEAPON_DAMAGE_MODIFIERS } from "./weapon-damage"
import { SPELL_DAMAGE_MODIFIERS } from "./spell-damage"
import { GLOBAL_DAMAGE_MODIFIERS } from "./global-damage"
import { DEFENSE_MODIFIERS } from "./defense"
import { RESISTANCE_MODIFIERS } from "./resistances"
import { ATTRIBUTE_MODIFIERS } from "./attributes"
import { UTILITY_MODIFIERS } from "./utility"
import { MAGIC_FIND_MODIFIERS } from "./magic-find"
import type { Modifier, ModifierTier } from "../../types"

export const MODIFIERS = {
	...WEAPON_DAMAGE_MODIFIERS,
	...SPELL_DAMAGE_MODIFIERS,
	...GLOBAL_DAMAGE_MODIFIERS,
	...DEFENSE_MODIFIERS,
	...RESISTANCE_MODIFIERS,
	...ATTRIBUTE_MODIFIERS,
	...UTILITY_MODIFIERS,
	...MAGIC_FIND_MODIFIERS,
} as const

export type ModifierId = Extract<keyof typeof MODIFIERS, string>

export function getModifier(id: ModifierId): Modifier {
	return MODIFIERS[id]
}

export function getModifierTierForItemLevel(
	modifierId: ModifierId,
	itemLevel: number,
): ModifierTier | null {
	const modifier = MODIFIERS[modifierId]
	return (
		modifier.tiers.find(
			(t) => itemLevel >= t.minItemLevel && itemLevel <= t.maxItemLevel,
		) ?? null
	)
}

