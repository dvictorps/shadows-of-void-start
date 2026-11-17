import type { EquippedSlot } from "../stats/types";
import type { GeneratedItem } from "./types";
import type { WeaponType } from "./types/base";

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

export interface EquipPlanInput {
	item: GeneratedItem;
	targetSlot: EquippedSlot;
	currentEquipped: ReadonlyArray<{ slot: EquippedSlot; item: GeneratedItem }>;
}

export interface EquipPlan {
	displaced: Array<{ slot: EquippedSlot; item: GeneratedItem }>;
	reject?:
		| "wrong-slot"
		| "mixed-archetype"
		| "needs-main-hand"
		| "needs-bow"
		| "offhand-not-weapon";
}

export function planEquip({
	item,
	targetSlot,
	currentEquipped,
}: EquipPlanInput): EquipPlan {
	if (!validSlotsForItem(item).includes(targetSlot)) {
		return { displaced: [], reject: "wrong-slot" };
	}

	const mainHand = currentEquipped.find((eq) => eq.slot === "weapon");
	const offHand = currentEquipped.find((eq) => eq.slot === "offhand");

	let displaced: EquipPlan["displaced"] = [];
	if (targetSlot === "weapon") {
		displaced = displacedByMainHand(item, offHand);
	} else if (targetSlot === "offhand") {
		const plan = planOffHand(item, mainHand);
		if (plan.reject) return plan;
		displaced = plan.displaced;
	}

	const occupant = currentEquipped.find((eq) => eq.slot === targetSlot);
	if (occupant && !displaced.some((d) => d.slot === occupant.slot)) {
		displaced.push(occupant);
	}

	return { displaced };
}

type Equipped = EquipPlan["displaced"][number];

function displacedByMainHand(
	item: GeneratedItem,
	offHand: Equipped | undefined,
): EquipPlan["displaced"] {
	if (!offHand) return [];
	const quiverOff = isQuiver(offHand.item);
	if (isTwoHanded(item)) return isBow(item) && quiverOff ? [] : [offHand];
	return quiverOff ? [offHand] : [];
}

function planOffHand(
	item: GeneratedItem,
	mainHand: Equipped | undefined,
): EquipPlan {
	if (isQuiver(item)) {
		return mainHand && isBow(mainHand.item)
			? { displaced: [] }
			: { displaced: [], reject: "needs-bow" };
	}
	const twoHandedMain =
		mainHand && isTwoHanded(mainHand.item) ? mainHand : undefined;
	if (isWeapon(item)) {
		const keptMain = twoHandedMain ? undefined : mainHand;
		if (!keptMain) return { displaced: [], reject: "needs-main-hand" };
		const newArch = weaponArchetype(item);
		const mainArch = weaponArchetype(keptMain.item);
		if (!newArch || !mainArch || newArch !== mainArch) {
			return { displaced: [], reject: "mixed-archetype" };
		}
	} else if (
		item.equipmentType !== "offhand" &&
		item.equipmentType !== "tome"
	) {
		return { displaced: [], reject: "offhand-not-weapon" };
	}
	return { displaced: twoHandedMain ? [twoHandedMain] : [] };
}

export function canSwapHands(
	mainHand: GeneratedItem | null,
	offHand: GeneratedItem | null,
): boolean {
	if (!mainHand || !offHand) return false;
	if (!isWeapon(mainHand) || !isWeapon(offHand)) return false;
	if (isTwoHanded(mainHand) || isTwoHanded(offHand)) return false;
	const mainArch = weaponArchetype(mainHand);
	const offArch = weaponArchetype(offHand);
	if (!mainArch || !offArch || mainArch !== offArch) return false;
	const mainValid = validSlotsForItem(mainHand);
	const offValid = validSlotsForItem(offHand);
	return mainValid.includes("offhand") && offValid.includes("weapon");
}
