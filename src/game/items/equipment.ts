import type { EquippedSlot } from "../stats/types";
import type { GeneratedItem } from "./types";
import type { WeaponType } from "./types/base";

// ── Archetypes ──

const ATTACK_WEAPONS: ReadonlySet<WeaponType> = new Set<WeaponType>([
	"sword",
	"dagger",
	"axe",
	"mace",
	"greatsword",
	"twoHandedAxe",
	"bow",
]);

const CASTER_WEAPONS: ReadonlySet<WeaponType> = new Set<WeaponType>([
	"wand",
	"staff",
]);

const TWO_HANDED: ReadonlySet<WeaponType> = new Set<WeaponType>([
	"greatsword",
	"twoHandedAxe",
	"bow",
	"staff",
]);

export type WeaponArchetype = "attack" | "caster";

export function isWeapon(item: GeneratedItem): boolean {
	return item.equipmentType === "weapon" && item.weaponType !== undefined;
}

export function isTwoHanded(item: GeneratedItem): boolean {
	return !!item.weaponType && TWO_HANDED.has(item.weaponType);
}

export function isBow(item: GeneratedItem): boolean {
	return item.weaponType === "bow";
}

export function isQuiver(item: GeneratedItem): boolean {
	return item.equipmentType === "quiver";
}

export function weaponArchetype(item: GeneratedItem): WeaponArchetype | null {
	if (!item.weaponType) return null;
	if (ATTACK_WEAPONS.has(item.weaponType)) return "attack";
	if (CASTER_WEAPONS.has(item.weaponType)) return "caster";
	return null;
}

// ── Slot eligibility ──

/**
 * Returns the equipment slots this item is allowed to occupy. Used for
 * drag-and-drop validation and for the click-dropdown's option list.
 */
export function validSlotsForItem(item: GeneratedItem): EquippedSlot[] {
	switch (item.equipmentType) {
		case "helmet":
			return ["helmet"];
		case "chestplate":
			return ["chestplate"];
		case "boots":
			return ["boots"];
		case "gloves":
			return ["gloves"];
		case "amulet":
			return ["amulet"];
		case "belt":
			return ["belt"];
		case "ring":
			return ["ring1", "ring2"];
		case "offhand":
		case "tome":
		case "quiver":
			return ["offhand"];
		case "weapon":
			if (!item.weaponType) return [];
			if (isTwoHanded(item)) return ["weapon"];
			return ["weapon", "offhand"];
		default:
			return [];
	}
}

// ── Equip preview: determine displacements + same-archetype guard ──

export interface EquipPlanInput {
	item: GeneratedItem;
	targetSlot: EquippedSlot;
	currentEquipped: ReadonlyArray<{ slot: EquippedSlot; item: GeneratedItem }>;
}

export interface EquipPlan {
	/** Items already equipped that will be pushed back to inventory. */
	displaced: Array<{ slot: EquippedSlot; item: GeneratedItem }>;
	/** Failure reason if the equip can't proceed. */
	reject?:
		| "wrong-slot"
		| "mixed-archetype"
		| "needs-main-hand"
		| "needs-bow"
		| "offhand-not-weapon";
}

/**
 * Pure computation of what an equip action would displace and whether it is
 * allowed. Used by client (preview) and server (validation). Does not check
 * level/attribute requirements — that's handled separately via the stat
 * engine (callers compute the post-displacement totals then check reqs).
 *
 * Off-hand kinds (shield/tome/quiver) and the bow + quiver pairing are
 * specified in CONTEXT.md → Off-hand and Bow + Quiver.
 */
export function planEquip({
	item,
	targetSlot,
	currentEquipped,
}: EquipPlanInput): EquipPlan {
	const valid = validSlotsForItem(item);
	if (!valid.includes(targetSlot)) {
		return { displaced: [], reject: "wrong-slot" };
	}

	const occupant = currentEquipped.find((eq) => eq.slot === targetSlot);
	const mainHand = currentEquipped.find((eq) => eq.slot === "weapon");
	const offHand = currentEquipped.find((eq) => eq.slot === "offhand");

	const displaced: EquipPlan["displaced"] = [];

	if (targetSlot === "weapon") {
		// 2H weapon to main: normally displaces any off-hand. Bow + quiver is
		// the lone exception that survives the displacement.
		if (isTwoHanded(item) && offHand) {
			const bowAcceptsQuiver = isBow(item) && isQuiver(offHand.item);
			if (!bowAcceptsQuiver) displaced.push(offHand);
		}
		// 1H weapon to main: a quiver in the off-hand is now an orphan
		// (quiver requires a bow specifically). Auto-displace it.
		if (!isTwoHanded(item) && offHand && isQuiver(offHand.item)) {
			displaced.push(offHand);
		}
		// 2H non-bow to main while quiver was off: the off-hand displacement
		// above already covers this (any off-hand goes when a non-bow 2H lands).
	}

	if (targetSlot === "offhand") {
		if (isQuiver(item)) {
			// Quiver requires a bow main hand. No auto-equip-bow magic — the
			// player must already have a bow (or sequence the equips).
			if (!mainHand || !isBow(mainHand.item)) {
				return { displaced: [], reject: "needs-bow" };
			}
		} else {
			// Non-quiver to off-hand: displace 2H main (bow included, since
			// non-quiver off-hands can't coexist with bow).
			if (mainHand && isTwoHanded(mainHand.item)) {
				displaced.push(mainHand);
			}
			if (isWeapon(item)) {
				const newMainHand = displaced.some((d) => d.slot === "weapon")
					? null
					: (mainHand ?? null);
				if (!newMainHand) {
					return { displaced: [], reject: "needs-main-hand" };
				}
				const newArch = weaponArchetype(item);
				const mainArch = weaponArchetype(newMainHand.item);
				if (!newArch || !mainArch || newArch !== mainArch) {
					return { displaced: [], reject: "mixed-archetype" };
				}
			} else if (
				item.equipmentType !== "offhand" &&
				item.equipmentType !== "tome"
			) {
				return { displaced: [], reject: "offhand-not-weapon" };
			}
		}
	}

	// The current target-slot occupant always displaces too (unless it's
	// already in our displaced set — like if equipping to off-hand and main
	// hand was 2H, the off-hand might be empty, so no double-add).
	if (occupant && !displaced.some((d) => d.slot === occupant.slot)) {
		displaced.push(occupant);
	}

	return { displaced };
}
