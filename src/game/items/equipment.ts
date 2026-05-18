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
		| "offhand-not-weapon";
}

/**
 * Pure computation of what an equip action would displace and whether it is
 * allowed. Used by client (preview) and server (validation). Does not check
 * level/attribute requirements — that's handled separately via the stat
 * engine (callers compute the post-displacement totals then check reqs).
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

	// 2H to weapon slot pushes any off-hand out (it can't coexist).
	if (targetSlot === "weapon" && isTwoHanded(item) && offHand) {
		displaced.push(offHand);
	}

	// Equipping to off-hand while main hand is 2H: 2H is displaced (it was
	// blocking the off-hand anyway).
	if (targetSlot === "offhand" && mainHand && isTwoHanded(mainHand.item)) {
		displaced.push(mainHand);
	}

	// Off-hand weapon: enforce same-archetype with the (post-displacement)
	// main hand.
	if (targetSlot === "offhand" && isWeapon(item)) {
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
	}

	// Off-hand non-weapon must be a shield (equipmentType === "offhand").
	if (
		targetSlot === "offhand" &&
		!isWeapon(item) &&
		item.equipmentType !== "offhand"
	) {
		return { displaced: [], reject: "offhand-not-weapon" };
	}

	// The current target-slot occupant always displaces too (unless it's
	// already in our displaced set — like if equipping to off-hand and main
	// hand was 2H, the off-hand might be empty, so no double-add).
	if (occupant && !displaced.some((d) => d.slot === occupant.slot)) {
		displaced.push(occupant);
	}

	return { displaced };
}
