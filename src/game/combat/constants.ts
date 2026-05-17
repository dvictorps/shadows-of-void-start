// Fraction of max HP restored by a potion. Shared by client (optimistic heal
// in useCombatLoop) and server (authoritative consumePotion) so balance
// changes can't drift between the two.
export const POTION_HEAL_FRACTION = 0.2;
