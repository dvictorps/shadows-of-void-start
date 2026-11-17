import { hasOwnKey, typedKeys } from "../../../typed-object";
import type { Modifier, ModifierTier } from "../../types";
import { ATTRIBUTE_MODIFIERS } from "./attributes";
import { DEFENSE_MODIFIERS } from "./defense";
import { GLOBAL_DAMAGE_MODIFIERS } from "./global-damage";
import { MAGIC_FIND_MODIFIERS } from "./magic-find";
import { RESISTANCE_MODIFIERS } from "./resistances";
import { SPELL_DAMAGE_MODIFIERS } from "./spell-damage";
import { TOME_MODIFIERS } from "./tome";
import { UTILITY_MODIFIERS } from "./utility";
import { WEAPON_DAMAGE_MODIFIERS } from "./weapon-damage";

export const MODIFIERS = {
	...WEAPON_DAMAGE_MODIFIERS,
	...SPELL_DAMAGE_MODIFIERS,
	...GLOBAL_DAMAGE_MODIFIERS,
	...DEFENSE_MODIFIERS,
	...RESISTANCE_MODIFIERS,
	...ATTRIBUTE_MODIFIERS,
	...UTILITY_MODIFIERS,
	...MAGIC_FIND_MODIFIERS,
	...TOME_MODIFIERS,
} as const;

export type ModifierId = Extract<keyof typeof MODIFIERS, string>;

export const MODIFIER_IDS: readonly ModifierId[] = typedKeys(MODIFIERS);

export function getModifier(id: ModifierId): Modifier {
	return MODIFIERS[id];
}

export function isModifierId(id: string): id is ModifierId {
	return hasOwnKey(MODIFIERS, id);
}

export function findModifier(id: string): Modifier | undefined {
	return isModifierId(id) ? MODIFIERS[id] : undefined;
}

export function getModifierTierForItemLevel(
	modifierId: ModifierId,
	itemLevel: number,
): ModifierTier | null {
	const modifier = MODIFIERS[modifierId];
	return (
		modifier.tiers.find(
			(t) => itemLevel >= t.minItemLevel && itemLevel <= t.maxItemLevel,
		) ?? null
	);
}
